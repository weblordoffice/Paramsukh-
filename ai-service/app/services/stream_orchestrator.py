import json
from typing import Any, AsyncGenerator
from uuid import uuid4

from app.core.config import get_settings
from app.core.exceptions import ConfigurationError, ToolExecutionError
from app.core.logging import get_logger
from app.models.chat import (
    ChatRequest,
    EnrichedChatResponse,
    StreamEvent,
    ToolExecution,
    MemoryItem,
)
from app.services.openai_service import OpenAIService
from app.services.orchestrator import ChatOrchestrator
from app.services.suggestions import generate_follow_up, generate_status_text, generate_suggested_actions
from app.services.result_builder import build_result_sections
from app.tools.registry import ToolRegistry

logger = get_logger(__name__)

class StreamingChatOrchestrator:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.registry = ToolRegistry()
        self.sync_orchestrator = ChatOrchestrator()

    async def _execute_tool_with_events(
        self,
        tool_name: str,
        arguments: dict[str, Any],
        payload: ChatRequest
    ) -> tuple[ToolExecution, list[StreamEvent]]:
        events = []
        events.append(StreamEvent(event="action_status", data={"message": generate_status_text(tool_name)}))
        
        try:
            result = await self.registry.execute(tool_name, arguments, payload)
            execution = ToolExecution(tool_name=tool_name, arguments=arguments, result=result, success=bool(result.get("success", True)))
        except ConfigurationError as exc:
            logger.warning("Tool configuration error for %s: %s", tool_name, exc)
            result = {"success": False, "message": str(exc)}
            execution = ToolExecution(tool_name=tool_name, arguments=arguments, result=result, success=False)
        except ToolExecutionError as exc:
            logger.warning("Tool execution error for %s: %s", tool_name, exc)
            result = {"success": False, "message": str(exc), "details": exc.details}
            execution = ToolExecution(tool_name=tool_name, arguments=arguments, result=result, success=False)
        except Exception as exc:
            logger.exception("Unexpected tool error for %s", tool_name)
            result = {"success": False, "message": "Unexpected tool failure.", "details": str(exc)}
            execution = ToolExecution(tool_name=tool_name, arguments=arguments, result=result, success=False)
            
        events.append(StreamEvent(event="action_status", data={"message": None}))
        return execution, events

    def _extract_chunk_text(self, chunk: Any) -> str:
        """Helper to extract text from a streaming chunk regardless of the SDK structure."""
        if getattr(chunk, "type", None) == "response.output_text.delta":
            if hasattr(chunk, "delta") and isinstance(chunk.delta, str):
                return chunk.delta
            return ""

        if hasattr(chunk, "choices") and chunk.choices:
            delta = chunk.choices[0].delta
            if hasattr(delta, "content") and delta.content:
                return delta.content
        return ""

    def _extract_tool_calls(self, chunk: Any) -> list[Any]:
        if getattr(chunk, "type", None) == "response.output_item.done":
            item = getattr(chunk, "item", None)
            if item and getattr(item, "type", None) == "function_call":
                return [item]
        return []

    async def stream_chat(self, payload: ChatRequest) -> AsyncGenerator[StreamEvent, None]:
        session_id = payload.session_id or str(uuid4())
        
        # 1. Lightweight response check
        lightweight_response = self.sync_orchestrator.build_lightweight_response(payload.message)
        if lightweight_response:
            yield StreamEvent(event="text_delta", data={"text": lightweight_response})
            yield StreamEvent(event="suggested_actions", data={"actions": [
                a.model_dump() for a in generate_suggested_actions([], payload)
            ]})
            yield StreamEvent(event="done", data={"session_id": session_id})
            return

        if not self.settings.openai_api_key:
            yield StreamEvent(event="text_delta", data={"text": "AI service is scaffolded, but OPENAI_API_KEY is not configured yet. Add it to ai-service/.env before enabling chat responses."})
            yield StreamEvent(event="done", data={"session_id": session_id})
            return

        service = OpenAIService()
        extracted_memory = service.extract_memory_items(payload)
        
        # 2. Check for Intent fallbacks (Direct tool execution)
        direct_tool_name = None
        direct_args = {}
        direct_answer = ""
        
        if self.sync_orchestrator.is_course_comparison_intent(payload.message):
            direct_tool_name = "compare_courses"
            direct_answer = "I compared the most relevant courses for you.\n\n"
        elif self.sync_orchestrator.is_continue_learning_intent(payload.message):
            direct_tool_name = "get_continue_learning"
            direct_args = {"limit": 5}
            direct_answer = "Here are the courses you can continue right now.\n\n"
        elif self.sync_orchestrator.is_play_current_lesson_intent(payload.message):
            direct_tool_name = "play_current_lesson"
            direct_answer = "I checked your current lesson state for the most relevant enrolled course.\n\n"
        elif self.sync_orchestrator.is_enrollment_overview_intent(payload.message):
            direct_tool_name = "get_my_enrollments"
            status = "all"
            normalized_message = " ".join(payload.message.lower().strip().split())
            if any(marker in normalized_message for marker in ("completed", "what have i completed", "finished")):
                status = "completed"
            elif any(marker in normalized_message for marker in ("in progress", "doing", "currently learning")):
                status = "in_progress"
            direct_args = {"status": status, "limit": 8}
            direct_answer = "I pulled your current learning overview from ParamSukh.\n\n"
        elif self.sync_orchestrator.is_broad_course_listing_intent(payload.message):
            direct_tool_name = "search_courses"
            direct_answer = "Here are the available courses in ParamSukh right now.\n\n"
        elif self.sync_orchestrator.is_event_comparison_intent(payload.message):
            direct_tool_name = "compare_events"
            direct_answer = "Here is a comparison of the selected events."

        if direct_tool_name:
            execution, events = await self._execute_tool_with_events(direct_tool_name, direct_args, payload)
            for event in events:
                yield event
            
            if execution.success:
                tool_history = [execution]
                
                # Yield text
                yield StreamEvent(event="text_delta", data={"text": direct_answer})
                
                # Yield results
                if tool_history:
                    yield StreamEvent(event="results", data={"tools_used": [t.model_dump() for t in tool_history]})
                
                # Yield follow up & suggested actions
                follow_up = generate_follow_up(tool_history, direct_answer, payload)
                if follow_up:
                    yield StreamEvent(event="follow_up", data={"message": follow_up})
                
                actions = generate_suggested_actions(tool_history, payload)
                if actions:
                    yield StreamEvent(event="suggested_actions", data={"actions": [a.model_dump() for a in actions]})
                    
                yield StreamEvent(event="done", data={"session_id": session_id})
                return

        # 3. Regular streaming flow
        tool_calls = []
        initial_response_id = ""
        full_answer = ""
        
        yield StreamEvent(event="action_status", data={"message": "Thinking..."})
        
        try:
            stream = service.create_streaming_response(payload)
            async for chunk in stream:
                # Extract text
                chunk_text = self._extract_chunk_text(chunk)
                if chunk_text:
                    full_answer += chunk_text
                    yield StreamEvent(event="text_delta", data={"text": chunk_text})
                
                # Extract tool calls (if any)
                chunk_tool_calls = self._extract_tool_calls(chunk)
                if chunk_tool_calls:
                    tool_calls.extend(chunk_tool_calls)
                    
                if hasattr(chunk, "response") and chunk.response and hasattr(chunk.response, "id"):
                    initial_response_id = chunk.response.id
                elif hasattr(chunk, "id"):
                    initial_response_id = chunk.id
                    
        except Exception as e:
            import traceback
            traceback.print_exc()
            logger.exception("Streaming response failed")
            yield StreamEvent(event="error", data={"message": str(e)})
            yield StreamEvent(event="done", data={"session_id": session_id})
            return

        if not tool_calls:
            # Done!
            actions = generate_suggested_actions([], payload)
            if actions:
                yield StreamEvent(event="suggested_actions", data={"actions": [a.model_dump() for a in actions]})
            yield StreamEvent(event="done", data={"session_id": session_id})
            return

        # 4. Handle tool execution
        tool_history = []
        tool_outputs = []
        
        for call in tool_calls:
            args = service.parse_tool_arguments(call.arguments)
            execution, events = await self._execute_tool_with_events(call.name, args, payload)
            for event in events:
                yield event
            tool_history.append(execution)
            tool_outputs.append({
                "type": "function_call_output",
                "call_id": call.call_id,
                "output": json.dumps(execution.result, ensure_ascii=True),
            })
            
        # 5. Yield results as tools_used
        if tool_history:
            yield StreamEvent(event="results", data={"tools_used": [t.model_dump() for t in tool_history]})

        # 6. Stream Follow-up Response
        try:
            followup_stream = service.create_streaming_followup(payload, initial_response_id, tool_outputs)
            async for chunk in followup_stream:
                chunk_text = self._extract_chunk_text(chunk)
                if chunk_text:
                    full_answer += chunk_text
                    yield StreamEvent(event="text_delta", data={"text": chunk_text})
        except Exception as e:
            logger.exception("Streaming followup failed")
            # Don't abort completely if followup fails, we still have the results.
        
        # 7. Follow-up hint & actions
        follow_up = generate_follow_up(tool_history, full_answer, payload)
        if follow_up:
            yield StreamEvent(event="follow_up", data={"message": follow_up})
        
        actions = generate_suggested_actions(tool_history, payload)
        if actions:
            yield StreamEvent(event="suggested_actions", data={"actions": [a.model_dump() for a in actions]})
            
        yield StreamEvent(event="done", data={"session_id": session_id})
