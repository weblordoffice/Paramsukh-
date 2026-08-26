import json
import re
from typing import Any
from uuid import uuid4

from app.core.config import get_settings
from app.core.exceptions import ConfigurationError, ToolExecutionError
from app.core.logging import get_logger
from app.models.chat import ChatRequest, ChatResponse, ResponseNarrative, ToolExecution
from app.services.openai_service import OpenAIService
from app.tools.registry import ToolRegistry

logger = get_logger(__name__)

LIGHTWEIGHT_RESPONSES: dict[str, str] = {
    "hi": "Hello! I can help with courses, memberships, events, podcasts, and your learning journey. What would you like to know?",
    "hello": "Hello! I can help with courses, memberships, events, podcasts, and your learning journey. What would you like to know?",
    "hey": "Hey! I can help with courses, memberships, events, podcasts, and your learning journey. What would you like to know?",
    "thanks": "You're welcome. If you want, ask me about courses, memberships, events, or your progress.",
    "thank you": "You're welcome. If you want, ask me about courses, memberships, events, or your progress.",
    "ok": "Sure. Tell me what you want help with in ParamSukh and I will guide you.",
    "okay": "Sure. Tell me what you want help with in ParamSukh and I will guide you.",
}


class ChatOrchestrator:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.registry = ToolRegistry()

    @staticmethod
    def build_lightweight_response(message: str) -> str | None:
        normalized = " ".join(message.lower().strip().split())
        return LIGHTWEIGHT_RESPONSES.get(normalized)

    @staticmethod
    def is_event_comparison_intent(message: str) -> bool:
        normalized = " ".join(message.lower().strip().split())
        comparison_markers = (
            "compare",
            "which one is better",
            "which is better",
            "better for beginners",
            "better for families",
            "better for working professionals",
            "gives more value",
            "more value",
        )
        return any(marker in normalized for marker in comparison_markers)

    @staticmethod
    def is_course_comparison_intent(message: str) -> bool:
        normalized = " ".join(message.lower().strip().split())
        course_markers = ("course", "courses", "learning", "completion")
        comparison_markers = (
            "compare",
            "which one is better",
            "which is better",
            "better for beginners",
            "should i finish first",
            "what should i finish first",
            "closest to completion",
            "complete next",
            "which course should i finish",
            "which should i complete",
            "shorter",
            "deeper",
        )
        return any(marker in normalized for marker in course_markers) and any(
            marker in normalized for marker in comparison_markers
        )

    @staticmethod
    def is_broad_course_listing_intent(message: str) -> bool:
        normalized = " ".join(message.lower().strip().split())
        course_markers = ("course", "courses", "learning path", "learning paths", "catalog")
        listing_markers = (
            "show",
            "list",
            "available",
            "all",
            "what",
            "browse",
            "find",
            "tell me",
        )
        has_course_marker = any(marker in normalized for marker in course_markers)
        has_listing_marker = any(marker in normalized for marker in listing_markers)
        has_topic_hint = any(
            marker in normalized
            for marker in (
                "beginner",
                "meditation",
                "bhakti",
                "yoga",
                "healing",
                "progress",
                "enrolled",
                "recommend",
                "best",
                "which",
            )
        )
        return has_course_marker and has_listing_marker and not has_topic_hint

    @staticmethod
    def is_enrollment_overview_intent(message: str) -> bool:
        normalized = " ".join(message.lower().strip().split())
        course_markers = ("course", "courses", "learning", "progress", "completed")
        personal_markers = (
            "my enrolled",
            "my courses",
            "i am doing",
            "am i doing",
            "my progress",
            "what have i completed",
            "completed courses",
            "enrolled courses",
            "my learning",
        )
        return any(marker in normalized for marker in course_markers) and any(
            marker in normalized for marker in personal_markers
        )

    @staticmethod
    def is_continue_learning_intent(message: str) -> bool:
        normalized = " ".join(message.lower().strip().split())
        continue_markers = (
            "continue learning",
            "continue next",
            "pick up where i left off",
            "what should i continue",
            "resume my course",
            "what am i learning next",
        )
        return any(marker in normalized for marker in continue_markers)

    @staticmethod
    def is_community_groups_intent(message: str) -> bool:
        normalized = " ".join(message.lower().strip().split())
        group_markers = (
            "community",
            "group",
            "groups",
            "circle",
            "circles",
            "discussion",
            "communities",
        )
        listing_markers = (
            "show",
            "list",
            "my",
            "joined",
            "active",
            "available",
            "which",
            "what",
            "belong",
        )
        return any(marker in normalized for marker in group_markers) and any(
            marker in normalized for marker in listing_markers
        )

    @staticmethod
    def is_community_feed_intent(message: str) -> bool:
        normalized = " ".join(message.lower().strip().split())
        community_markers = ("community", "group", "discussion", "feed", "post", "posts")
        feed_markers = (
            "latest",
            "recent",
            "feed",
            "posts",
            "what is happening",
            "what's happening",
            "updates",
            "discussion",
        )
        return any(marker in normalized for marker in community_markers) and any(
            marker in normalized for marker in feed_markers
        )

    @staticmethod
    def is_community_comments_intent(message: str) -> bool:
        normalized = " ".join(message.lower().strip().split())
        return "comment" in normalized or "comments" in normalized or "replies" in normalized or "reply" in normalized

    @staticmethod
    def is_play_current_lesson_intent(message: str) -> bool:
        normalized = " ".join(message.lower().strip().split())
        action_markers = ("play", "resume", "open", "continue", "watch", "start")
        lesson_markers = (
            "current lesson",
            "current video",
            "next lesson",
            "lesson",
            "video",
            "where i left off",
            "current course",
        )
        course_markers = ("course", "courses", "learning")
        return (
            any(marker in normalized for marker in action_markers)
            and any(marker in normalized for marker in lesson_markers)
        ) or (
            any(marker in normalized for marker in action_markers)
            and any(marker in normalized for marker in course_markers)
            and "left off" in normalized
        )

    async def _build_direct_tool_response(
        self,
        *,
        payload: ChatRequest,
        tool_name: str,
        arguments: dict[str, Any],
        answer: str,
        memory_items: list[Any],
        service: OpenAIService,
    ) -> ChatResponse | None:
        try:
            result = await self.registry.execute(tool_name, arguments, payload)
        except Exception:
            logger.exception("Direct fallback failed for %s", tool_name)
            return None

        if not result.get("success", True):
            return None

        tool_history = [
            ToolExecution(
                tool_name=tool_name,
                arguments=arguments,
                result=result,
                success=True,
            )
        ]
        return ChatResponse(
            answer=answer,
            model=self.settings.openai_model,
            session_id=payload.session_id or str(uuid4()),
            tools_used=tool_history,
            memory_items=memory_items,
            conversation_summary=service.build_conversation_summary(payload, answer),
            response_narrative=self.build_response_narrative(
                answer,
                has_structured_results=True,
                tool_history=tool_history,
            ),
        )

    @staticmethod
    def _clean_narrative_text(value: str | None) -> str:
        return " ".join(str(value or "").strip().split()).strip()

    @classmethod
    def _tool_result_summary(cls, tool_execution: ToolExecution | None) -> str | None:
        if tool_execution is None or not isinstance(tool_execution.result, dict):
            return None
        result = tool_execution.result
        summary = cls._clean_narrative_text(result.get("summary"))
        if summary:
            return summary

        data = result.get("data") if isinstance(result.get("data"), dict) else {}
        for key in ("message", "follow_up"):
            candidate = cls._clean_narrative_text(data.get(key))
            if candidate:
                return candidate
        return None

    @classmethod
    def _tool_follow_up_hint(cls, tool_execution: ToolExecution | None) -> str | None:
        if tool_execution is None or not isinstance(tool_execution.result, dict):
            return None
        result = tool_execution.result
        data = result.get("data") if isinstance(result.get("data"), dict) else {}

        explicit_follow_up = cls._clean_narrative_text(data.get("follow_up"))
        if explicit_follow_up:
            return explicit_follow_up

        follow_up_map = {
            "search_courses": "If you want, I can narrow these down by topic, beginner level, or membership access.",
            "recommend_courses": "If you want, I can compare the strongest options or help you enroll in one.",
            "compare_courses": "If you want, I can also show your enrolled courses, detailed progress, or what to continue next.",
            "get_my_enrollments": "If you want, I can also show only your active courses, only completed ones, or the progress for one course.",
            "get_continue_learning": "If you want, I can also open your current lesson, show your full enrolled courses, or compare what to finish next.",
            "get_course_progress": "If you want, I can also open the current lesson or show the rest of your learning progress.",
            "enroll_in_course": "If you want, I can also open the current lesson, show your progress, or help with your other courses.",
            "play_current_lesson": "If you want, I can also show your enrolled courses, your course progress, or help you choose what to continue next.",
            "search_events": "If you want, I can also filter these by free versus paid, compare a few, or help you register.",
            "compare_events": "If you want, I can also help you register for one of these or show more similar events.",
            "get_event_details": "If you want, I can also help you register, compare it with another event, or show more upcoming options.",
            "register_for_event": "If you want, I can also show your bookings, event details, or other upcoming events.",
            "cancel_event_registration": "If you want, I can also show your current bookings or help you find another event.",
            "get_membership_plans": "If you want, I can also compare the plans or start the purchase flow for one.",
            "start_membership_purchase": "After that, I can help you check your plan status or continue with course access.",
            "search_podcasts": "If you want, I can also narrow these down by category or based on your interests.",
            "search_support_content": "If you want, I can also help with the next app step or show the most relevant support option.",
            "get_support_messages": "If you want, I can also help you understand the latest update or suggest the next step.",
            "get_community_groups": "If you want, I can also open the discussion feed for one group or help you choose the most relevant community.",
            "get_community_posts": "If you want, I can also help you open another group, summarize the discussion, or create a community action flow next.",
            "get_post_comments": "If you want, I can also help you reply to the post, open another thread, or go back to the main community feed.",
            "create_community_post": "If you want, I can also open the updated group feed, help you write a follow-up post, or guide the next community action.",
            "create_post_comment": "If you want, I can also open the updated thread, help you write another reply, or move back to the main community feed.",
            "like_community_post": "If you want, I can also open the comments, help you reply to the post, or switch to another community discussion.",
            "reply_to_post_comment": "If you want, I can also open the updated thread, help you continue the discussion, or move back to the full post comments.",
        }
        return follow_up_map.get(tool_execution.tool_name)

    @staticmethod
    def _first_successful_tool(tool_history: list[ToolExecution] | None) -> ToolExecution | None:
        if not tool_history:
            return None
        for item in tool_history:
            if item.success:
                return item
        return None

    @classmethod
    def build_response_narrative(
        cls,
        answer: str,
        *,
        has_structured_results: bool,
        tool_history: list[ToolExecution] | None = None,
    ) -> ResponseNarrative | None:
        cleaned = answer.strip()
        if not cleaned:
            return None
        if not has_structured_results:
            return ResponseNarrative(intro=cleaned, outro=None)

        paragraphs = [part.strip() for part in re.split(r"\n\s*\n", cleaned) if part.strip()]
        primary_tool = cls._first_successful_tool(tool_history)
        tool_summary = cls._tool_result_summary(primary_tool)
        tool_follow_up = cls._tool_follow_up_hint(primary_tool)
        if len(paragraphs) >= 2:
            intro = paragraphs[0]
            outro = " ".join(paragraphs[1:]).strip() or None
            if tool_summary and len(intro) > 240:
                intro = tool_summary
            if not outro and tool_follow_up:
                outro = tool_follow_up
            return ResponseNarrative(
                intro=intro,
                outro=outro,
            )

        sentence_parts = re.split(r"(?<=[.!?])\s+", cleaned)
        if len(sentence_parts) >= 3:
            intro = " ".join(sentence_parts[:2]).strip()
            outro = " ".join(sentence_parts[2:]).strip()
            if tool_summary and len(intro) > 220:
                intro = tool_summary
            if not outro and tool_follow_up:
                outro = tool_follow_up
            return ResponseNarrative(intro=intro or cleaned, outro=outro or None)

        return ResponseNarrative(intro=tool_summary or cleaned, outro=tool_follow_up)

    async def handle_message(self, payload: ChatRequest) -> ChatResponse:
        extracted_memory: list[Any] = []
        lightweight_response = self.build_lightweight_response(payload.message)

        if lightweight_response:
            return ChatResponse(
                answer=lightweight_response,
                model="local-shortcut",
                session_id=payload.session_id or str(uuid4()),
                tools_used=[],
                memory_items=[],
                conversation_summary=lightweight_response,
                response_narrative=self.build_response_narrative(lightweight_response, has_structured_results=False),
            )

        if not self.settings.openai_api_key:
            return ChatResponse(
                answer=(
                    "AI service is scaffolded, but OPENAI_API_KEY is not configured yet. "
                    "Add it to ai-service/.env before enabling chat responses."
                ),
                model=self.settings.openai_model,
                session_id=payload.session_id or str(uuid4()),
                tools_used=[],
                memory_items=[],
                response_narrative=self.build_response_narrative(
                    "AI service is scaffolded, but OPENAI_API_KEY is not configured yet. Add it to ai-service/.env before enabling chat responses.",
                    has_structured_results=False,
                ),
            )

        service = OpenAIService()
        extracted_memory = service.extract_memory_items(payload)
        initial_response = service.create_initial_response(payload)
        tool_calls = [item for item in initial_response.output if item.type == "function_call"]

        if not tool_calls:
            if self.is_course_comparison_intent(payload.message):
                direct_response = await self._build_direct_tool_response(
                    payload=payload,
                    tool_name="compare_courses",
                    arguments={},
                    answer=(
                        "I compared the most relevant courses for you.\n\n"
                        "If you want, I can also show the full enrolled-course list, the detailed progress of one course, or help you choose what to continue next."
                    ),
                    memory_items=extracted_memory,
                    service=service,
                )
                if direct_response:
                    return direct_response

            if self.is_continue_learning_intent(payload.message):
                direct_response = await self._build_direct_tool_response(
                    payload=payload,
                    tool_name="get_continue_learning",
                    arguments={"limit": 5},
                    answer=(
                        "Here are the courses you can continue right now.\n\n"
                        "If you want, I can also show your full enrolled-course list or check the progress of one course."
                    ),
                    memory_items=extracted_memory,
                    service=service,
                )
                if direct_response:
                    return direct_response

            if self.is_play_current_lesson_intent(payload.message):
                direct_response = await self._build_direct_tool_response(
                    payload=payload,
                    tool_name="play_current_lesson",
                    arguments={},
                    answer=(
                        "I checked your current lesson state for the most relevant enrolled course.\n\n"
                        "Use the action card below and I will open the lesson directly when it is ready, or take you to the course screen when that is the better next step."
                    ),
                    memory_items=extracted_memory,
                    service=service,
                )
                if direct_response:
                    return direct_response

            if self.is_enrollment_overview_intent(payload.message):
                normalized_message = " ".join(payload.message.lower().strip().split())
                status = "all"
                if any(marker in normalized_message for marker in ("completed", "what have i completed", "finished")):
                    status = "completed"
                elif any(marker in normalized_message for marker in ("in progress", "doing", "currently learning")):
                    status = "in_progress"

                direct_response = await self._build_direct_tool_response(
                    payload=payload,
                    tool_name="get_my_enrollments",
                    arguments={"status": status, "limit": 8},
                    answer=(
                        "I pulled your current learning overview from ParamSukh.\n\n"
                        "If you want, I can also show only your completed courses, only your active ones, or the detailed progress for a specific course."
                    ),
                    memory_items=extracted_memory,
                    service=service,
                )
                if direct_response:
                    return direct_response

            if self.is_broad_course_listing_intent(payload.message):
                direct_response = await self._build_direct_tool_response(
                    payload=payload,
                    tool_name="search_courses",
                    arguments={},
                    answer=(
                        "Here are the available courses in ParamSukh right now.\n\n"
                        "If you want, I can also narrow these down for beginners, a specific topic, or your membership access."
                    ),
                    memory_items=extracted_memory,
                    service=service,
                )
                if direct_response:
                    return direct_response

            if self.is_community_groups_intent(payload.message):
                direct_response = await self._build_direct_tool_response(
                    payload=payload,
                    tool_name="get_community_groups",
                    arguments={},
                    answer=(
                        "I checked the community groups connected to your account.\n\n"
                        "If you want, I can also open the discussion feed for one of these groups or help you find the most relevant one."
                    ),
                    memory_items=extracted_memory,
                    service=service,
                )
                if direct_response:
                    return direct_response
            if self.is_community_feed_intent(payload.message):
                direct_response = await self._build_direct_tool_response(
                    payload=payload,
                    tool_name="get_community_posts",
                    arguments={},
                    answer=(
                        "Here is the latest discussion feed I could open from your community context.\n\n"
                        "If you want, I can also open the comments on a post or switch to another community group."
                    ),
                    memory_items=extracted_memory,
                    service=service,
                )
                if direct_response:
                    return direct_response

            if self.is_community_comments_intent(payload.message):
                direct_response = await self._build_direct_tool_response(
                    payload=payload,
                    tool_name="get_post_comments",
                    arguments={},
                    answer=(
                        "I opened the comment thread for that community discussion.\n\n"
                        "If you want, I can also help you go back to the feed or interact with another post."
                    ),
                    memory_items=extracted_memory,
                    service=service,
                )
                if direct_response:
                    return direct_response
            if self.is_event_comparison_intent(payload.message):
                try:
                    result = await self.registry.execute("compare_events", {}, payload)
                    if result.get("success", True):
                        answer = str(result.get("summary") or "Here is a comparison of the selected events.").strip()
                        tool_history = [
                            ToolExecution(
                                tool_name="compare_events",
                                arguments={},
                                result=result,
                                success=True,
                            )
                        ]
                        return ChatResponse(
                            answer=answer,
                            model=self.settings.openai_model,
                            session_id=payload.session_id or str(uuid4()),
                            tools_used=tool_history,
                            memory_items=extracted_memory,
                            conversation_summary=service.build_conversation_summary(payload, answer),
                            response_narrative=self.build_response_narrative(
                                answer,
                                has_structured_results=True,
                                tool_history=tool_history,
                            ),
                        )
                except Exception:
                    logger.exception("Compare-events fallback failed")
            return ChatResponse(
                answer=initial_response.output_text,
                model=self.settings.openai_model,
                session_id=payload.session_id or str(uuid4()),
                tools_used=[],
                memory_items=extracted_memory,
                conversation_summary=service.build_conversation_summary(payload, initial_response.output_text),
                response_narrative=self.build_response_narrative(initial_response.output_text, has_structured_results=False),
            )

        tool_history: list[ToolExecution] = []
        tool_outputs: list[dict[str, Any]] = []

        for call in tool_calls:
            args: dict[str, Any] = {}
            try:
                args = service.parse_tool_arguments(call.arguments)
                result = await self.registry.execute(call.name, args, payload)
                tool_history.append(
                    ToolExecution(tool_name=call.name, arguments=args, result=result, success=bool(result.get("success", True)))
                )
            except ConfigurationError as exc:
                logger.warning("Tool configuration error for %s: %s", call.name, exc)
                result = {"success": False, "message": str(exc)}
                tool_history.append(
                    ToolExecution(tool_name=call.name, arguments={}, result=result, success=False)
                )
            except ToolExecutionError as exc:
                logger.warning("Tool execution error for %s: %s", call.name, exc)
                result = {"success": False, "message": str(exc), "details": exc.details}
                tool_history.append(
                    ToolExecution(tool_name=call.name, arguments=args if 'args' in locals() else {}, result=result, success=False)
                )
            except Exception as exc:
                logger.exception("Unexpected tool error for %s", call.name)
                result = {"success": False, "message": "Unexpected tool failure.", "details": str(exc)}
                tool_history.append(
                    ToolExecution(tool_name=call.name, arguments=args if 'args' in locals() else {}, result=result, success=False)
                )

            tool_outputs.append(
                {
                    "type": "function_call_output",
                    "call_id": call.call_id,
                    "output": json.dumps(result, ensure_ascii=True),
                }
            )

        final_response = service.create_followup_response(
            payload=payload,
            previous_response_id=initial_response.id,
            tool_outputs=tool_outputs,
        )

        return ChatResponse(
            answer=final_response.output_text,
            model=self.settings.openai_model,
            session_id=payload.session_id or str(uuid4()),
            tools_used=tool_history,
            memory_items=extracted_memory,
            conversation_summary=service.build_conversation_summary(payload, final_response.output_text),
            response_narrative=self.build_response_narrative(
                final_response.output_text,
                has_structured_results=bool(tool_history),
                tool_history=tool_history,
            ),
        )
