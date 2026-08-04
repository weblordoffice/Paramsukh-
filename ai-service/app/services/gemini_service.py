import json
from typing import Any, AsyncGenerator
from uuid import uuid4

import google.generativeai as genai

from app.core.config import get_settings
from app.core.exceptions import ConfigurationError
from app.core.logging import get_logger
from app.models.chat import ChatRequest, MemoryItem
from app.tools.registry import ToolRegistry

logger = get_logger(__name__)

MemoryRule = dict[str, Any]


class MockToolCall:
    def __init__(self, call_id: str, name: str, arguments: str):
        self.type = "function_call"
        self.call_id = call_id
        self.name = name
        self.arguments = arguments


class MockResponse:
    def __init__(self, response_id: str, output_text: str, tool_calls: list[Any] | None = None):
        self.id = response_id
        self.output_text = output_text
        self.output = [
            MockToolCall(tc.id, tc.function.name, tc.function.arguments)
            for tc in (tool_calls or [])
        ]


class MockItem:
    def __init__(self, name: str, arguments: str, call_id: str):
        self.type = "function_call"
        self.name = name
        self.arguments = arguments
        self.call_id = call_id


class MockDoneChunk:
    def __init__(self, item: MockItem, response_id: str):
        self.type = "response.output_item.done"
        self.item = item
        self.id = response_id


class _StreamChoice:
    class _Delta:
        def __init__(self, text: str):
            self.content = text
            self.tool_calls = None

    def __init__(self, text: str):
        self.delta = self._Delta(text)


class _StreamChunk:
    def __init__(self, text: str, chunk_id: str | None = None):
        self.choices = [_StreamChoice(text)]
        self.id = chunk_id


MEMORY_RULES: tuple[MemoryRule, ...] = (
    {
        "terms": ("beginner",), "category": "learning", "key": "experience_level",
        "value": "beginner", "confidence": 0.82, "match": "any",
    },
    {
        "terms": ("meditation",), "category": "goal", "key": "interest_topic",
        "value": "meditation", "confidence": 0.74, "match": "any",
    },
    {
        "terms": ("membership", "plan"), "category": "goal", "key": "interest_area",
        "value": "membership_guidance", "confidence": 0.68, "match": "any",
    },
    {
        "terms": ("short answer", "reply shortly", "concise"), "category": "preference",
        "key": "response_style", "value": "concise", "confidence": 0.9, "match": "any",
    },
    {
        "terms": ("hindi",), "category": "preference", "key": "language_preference",
        "value": "hindi", "confidence": 0.88, "match": "any",
    },
    {
        "terms": ("free events", "free event", "free ones"), "category": "preference",
        "key": "event_price_preference", "value": "free", "confidence": 0.8, "match": "any",
    },
    {
        "terms": ("paid events", "paid event", "premium events"), "category": "preference",
        "key": "event_price_preference", "value": "paid", "confidence": 0.74, "match": "any",
    },
    {
        "terms": ("online events", "online event", "online sessions"), "category": "preference",
        "key": "event_format_preference", "value": "online", "confidence": 0.81, "match": "any",
    },
    {
        "terms": ("meditation retreats", "meditation retreat"), "category": "preference",
        "key": "event_style_preference", "value": "meditation_retreat", "confidence": 0.78, "match": "any",
    },
    {
        "terms": ("beginner events", "beginner event"), "category": "preference",
        "key": "event_audience_preference", "value": "beginner", "confidence": 0.79, "match": "any",
    },
)


class GeminiService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.registry = ToolRegistry()
        if not self.settings.gemini_api_key:
            raise ConfigurationError("GEMINI_API_KEY is not configured.")
        genai.configure(api_key=self.settings.gemini_api_key)
        self.saved_contents: list[dict[str, Any]] = []

    @staticmethod
    def normalize_role(role: str) -> str:
        return role if role in {"user", "assistant"} else "assistant"

    def trim_history_content(self, content: str) -> str:
        cleaned = content.strip()
        if not cleaned:
            return ""
        if len(cleaned) <= self.settings.gemini_history_char_limit:
            return cleaned
        return cleaned[: self.settings.gemini_history_char_limit].rstrip() + "..."

    @staticmethod
    def match_memory_rule(text: str, rule: MemoryRule) -> bool:
        terms = rule["terms"]
        mode = rule.get("match", "any")
        if mode == "all":
            return all(term in text for term in terms)
        return any(term in text for term in terms)

    def build_context_lines(self, payload: ChatRequest) -> list[str]:
        import datetime as _dt_mod
        _today = _dt_mod.date.today()
        _tomorrow = _today + _dt_mod.timedelta(days=1)
        current_date_str = _dt_mod.datetime.now().strftime("%Y-%m-%d (%A)")

        screen_context = payload.metadata.get("current_screen", {})
        if isinstance(screen_context, str):
            screen_context = {"label": screen_context}
        elif not isinstance(screen_context, dict):
            screen_context = {}

        raw_context_items = [
            ("Today's date", current_date_str),
            ("Tomorrow's date", str(_tomorrow)),
            ("User name", payload.user.display_name),
            ("Subscription plan", payload.user.subscription_plan),
            ("Subscription status", payload.user.subscription_status),
            ("Current screen", screen_context.get("label")),
            ("Current screen hint", screen_context.get("hint")),
            ("Conversation summary", payload.conversation.summary if payload.conversation else None),
        ]
        context_lines = [f"{label}: {value}" for label, value in raw_context_items if value]

        active_memory = [
            f"{item.key}={item.value}"
            for item in payload.memory[: self.settings.gemini_memory_item_limit]
            if item.isActive
        ]
        if active_memory:
            context_lines.append("Remembered user context: " + "; ".join(active_memory))

        recent_tool_context: list[str] = []
        if payload.conversation:
            for item in reversed(payload.conversation.recent_messages):
                if item.role != "tool" or not item.toolName or not item.toolPayload:
                    continue
                tool_payload = item.toolPayload if isinstance(item.toolPayload, dict) else {}
                result = tool_payload.get("result") if isinstance(tool_payload, dict) else None
                summary = result.get("summary") if isinstance(result, dict) else None
                data = result.get("data") if isinstance(result, dict) else None
                line = None
                tn = item.toolName

                if tn == "search_events" and isinstance(data, dict):
                    event_items = data.get("items") or []
                    if isinstance(event_items, list) and event_items:
                        bits = []
                        for e in event_items[:3]:
                            if not isinstance(e, dict): continue
                            eid = e.get("id") or e.get("event_id")
                            t = e.get("title") or e.get("event_title")
                            if t: bits.append(f"{t} ({eid})" if eid else str(t))
                        if bits: line = "Recent event results: " + "; ".join(bits)
                elif tn == "get_my_event_registrations" and isinstance(data, dict):
                    regs = data.get("items") or []
                    if isinstance(regs, list) and regs:
                        bits = []
                        for r in regs[:3]:
                            if not isinstance(r, dict): continue
                            t = r.get("event_title")
                            if t: bits.append(f"{t} ({r.get('event_id', '')})" if r.get("event_id") else str(t))
                        if bits: line = "Recent registered events: " + "; ".join(bits)
                elif tn in {"search_courses", "get_my_enrollments", "get_continue_learning", "compare_courses", "play_current_lesson"} and isinstance(data, dict):
                    items = data.get("items") or []
                    if isinstance(items, list) and items:
                        bits = []
                        for c in items[:3]:
                            if not isinstance(c, dict): continue
                            t = c.get("title") or c.get("course_title")
                            if t: bits.append(f"{t} ({c.get('id') or c.get('course_id', '')})" if (c.get("id") or c.get("course_id")) else str(t))
                        if bits: line = "Recent course results: " + "; ".join(bits)
                elif tn == "get_my_counseling_bookings" and isinstance(data, dict):
                    bookings = data.get("bookings") or []
                    if isinstance(bookings, list) and bookings:
                        bits = []
                        for b in bookings[:5]:
                            if not isinstance(b, dict): continue
                            bits.append(f"{b.get('counselor_type') or 'Session'} on {b.get('booking_date')} at {b.get('booking_time')} ({b.get('status')}) [ID: {b.get('id')}]")
                        if bits: line = "Recent counseling bookings: " + "; ".join(bits)
                elif tn == "check_counselor_availability" and isinstance(data, dict):
                    slots = data.get("slots") or []
                    if slots:
                        line = f"Available slots for {data.get('counselor_type') or 'General'} on {data.get('date')}: " + ", ".join(slots[:6])
                elif tn in {"book_counseling_session", "cancel_counseling_booking"} and isinstance(data, dict):
                    line = f"Counseling tool: {tn}, action={data.get('action')}, date={data.get('booking_date')}, time={data.get('booking_time')}"
                    if data.get("booking_id"): line += f", booking_id={data['booking_id']}"
                elif tn == "search_podcasts" and isinstance(data, dict):
                    pods = data.get("items") or []
                    if isinstance(pods, list) and pods:
                        bits = []
                        for p in pods[:4]:
                            if not isinstance(p, dict): continue
                            bits.append(f"{p.get('title')} by {p.get('host')} [ID: {p.get('id')}]")
                        if bits: line = "Recent podcasts: " + "; ".join(bits)
                elif tn == "play_podcast" and isinstance(data, dict):
                    pod = data.get("podcast") or {}
                    line = f"Podcast playback: action={data.get('action')}, title='{pod.get('title') or 'podcast'}'"
                    if data.get("podcast_id") or pod.get("id"): line += f", id={data.get('podcast_id') or pod.get('id')}"
                elif tn == "search_products" and isinstance(data, dict):
                    prods = data.get("items") or []
                    if isinstance(prods, list) and prods:
                        bits = []
                        for p in prods[:5]:
                            if not isinstance(p, dict): continue
                            bits.append(f"{p.get('name')} [ID: {p.get('id')}, Price: {p.get('price')}]")
                        if bits: line = "Recent products: " + "; ".join(bits)
                elif tn in {"get_saved_addresses", "add_address"} and isinstance(data, dict):
                    addrs = data.get("items") or []
                    if not addrs and "address" in data: addrs = [data["address"]]
                    elif not addrs and "id" in data: addrs = [data]
                    if isinstance(addrs, list) and addrs:
                        bits = []
                        for a in addrs:
                            if not isinstance(a, dict): continue
                            bits.append(f"{a.get('fullName') or 'Addr'} - {a.get('addressLine1') or ''}, {a.get('city') or ''} ({a.get('type') or 'home'}) [ID: {a.get('id')}]")
                        if bits: line = "Saved addresses: " + "; ".join(bits)
                elif tn == "place_product_order" and isinstance(data, dict):
                    line = f"Order placed: action={data.get('action')}, order_id={data.get('order_id')}, order_number={data.get('order_number')}"
                    if data.get("payment_link_id"): line += f", payment_link_id={data['payment_link_id']}"
                elif tn == "confirm_order_payment" and isinstance(data, dict):
                    line = f"Payment confirm: action={data.get('action')}, order_id={data.get('order_id')}, order_number={data.get('order_number')}"
                elif tn == "request_address_form" and isinstance(data, dict):
                    line = "Opened interactive address entry form."
                elif tn == "get_community_groups" and isinstance(data, dict):
                    groups = data.get("groups") or []
                    if isinstance(groups, list) and groups:
                        bits = []
                        for g in groups:
                            if not isinstance(g, dict): continue
                            bits.append(f"{g.get('name')} [ID: {g.get('_id') or g.get('id')}]")
                        if bits: line = "Community groups: " + "; ".join(bits)
                elif tn == "get_community_posts" and isinstance(data, dict):
                    posts = data.get("posts") or []
                    if isinstance(posts, list) and posts:
                        bits = []
                        for p in posts[:5]:
                            if not isinstance(p, dict): continue
                            c = p.get("content") or ""
                            bits.append(f"Post '{c[:30]}{'...' if len(c) > 30 else ''}' [ID: {p.get('_id') or p.get('id')}]")
                        if bits: line = "Recent posts: " + "; ".join(bits)
                elif tn == "get_post_comments" and isinstance(data, dict):
                    comments = data.get("comments") or []
                    if isinstance(comments, list) and comments:
                        bits = []
                        for c in comments[:4]:
                            if not isinstance(c, dict): continue
                            author = c.get("author") or {}
                            name = str(author.get("displayName") or "Anonymous").strip()
                            txt = str(c.get("content") or "").strip()
                            if not txt: continue
                            bits.append(f"{name}: '{txt[:48]}{'...' if len(txt) > 48 else ''}'")
                        if bits: line = "Recent comments: " + "; ".join(bits)
                elif tn == "create_community_post" and isinstance(data, dict):
                    line = f"Community post: action={data.get('action')}, group='{data.get('group_name') or 'group'}', content='{self.trim_history_content(str(data.get('content') or 'draft'))}'"
                elif tn == "create_post_comment" and isinstance(data, dict):
                    line = f"Post comment: action={data.get('action')}, reply='{self.trim_history_content(str(data.get('content') or 'draft'))}'"
                elif tn == "like_community_post" and isinstance(data, dict):
                    line = f"Community like: action={data.get('action')}, post='{self.trim_history_content(str(data.get('post_content') or 'post'))}'"
                elif tn == "reply_to_post_comment" and isinstance(data, dict):
                    line = f"Comment reply: action={data.get('action')}, reply='{self.trim_history_content(str(data.get('content') or 'draft'))}'"

                if not line and summary:
                    line = f"Recent tool result from {tn}: {self.trim_history_content(str(summary))}"

                if line:
                    recent_tool_context.append(line)
                if len(recent_tool_context) >= 4:
                    break

        if recent_tool_context:
            context_lines.extend(recent_tool_context)

        return context_lines

    def build_conversation_summary(self, payload: ChatRequest, answer: str) -> str | None:
        user_messages = [
            item.content.strip()
            for item in (payload.conversation.recent_messages if payload.conversation else [])
            if item.role == "user" and item.content.strip()
        ]
        recent_user_focus = user_messages[-3:]
        parts: list[str] = []

        if recent_user_focus:
            parts.append("Recent user focus: " + " | ".join(self.trim_history_content(m) for m in recent_user_focus))

        active_memory = [
            f"{item.key}={item.value}"
            for item in payload.memory[: self.settings.gemini_memory_item_limit]
            if item.isActive
        ]
        if active_memory:
            parts.append("Persistent context: " + "; ".join(active_memory))

        snippet = self.trim_history_content(answer)
        if snippet:
            parts.append("Latest assistant direction: " + snippet)

        return " || ".join(parts)[:1500] if parts else None

    def build_system_prompt(self, payload: ChatRequest) -> str:
        prompt = (
            "You are the ParamSukh in-app AI guide. Help with courses, memberships, events, podcasts, and learning.\n"
            "Use tools when the answer depends on live app data. For general guidance, answer directly.\n\n"
            "TOOL POLICY (follow strictly):\n"
            "- search_courses: broad course listing, topic discovery. Use immediately for 'show courses' — don't ask for a topic first.\n"
            "- compare_courses: when the user wants to compare two courses or pick which to finish first.\n"
            "- recommend_courses: best-fit personalized course suggestions.\n"
            "- get_my_enrollments / get_continue_learning / get_course_progress: user's learning state.\n"
            "- enroll_in_course: only after explicit user confirmation.\n"
            "- play_current_lesson: when user wants to resume/play current lesson.\n"
            "- complete_course: mark course completed. Use user_confirmed=false first, then true on confirmation.\n"
            "- get_membership_plans / get_my_subscription: plan questions.\n"
            "- start_membership_purchase: only after user confirms a specific plan.\n"
            "- search_events: broad event discovery. Use immediately for 'show events'.\n"
            "- compare_events: when comparing two events.\n"
            "- get_event_details: specific event follow-ups.\n"
            "- get_my_event_registrations / register_for_event / cancel_event_registration: event booking lifecycle.\n"
            "- search_podcasts: podcast discovery.\n"
            "- play_podcast: user_confirmed=false first to show confirmation card, then true to play.\n"
            "- search_support_content / get_support_messages: help/FAQs.\n"
            "- search_counseling_services / check_counselor_availability / get_my_counseling_bookings / book_counseling_session / cancel_counseling_booking: counseling flow.\n"
            "- For availability checks, resolve relative dates ('tomorrow', 'this Friday') from Known context to YYYY-MM-DD.\n"
            "- If no date specified, assume today or tomorrow (prefer tomorrow past midday).\n"
            "- get_daily_guidance: daily affirmations, mood guidance, horoscope.\n"
            "- search_products / get_saved_addresses / get_my_orders / place_product_order / cancel_order / confirm_order_payment / request_address_form / add_address: shop flow.\n"
            "- Strict Purchase Flow: ask quantity → get_saved_addresses → ask COD/Razorpay → place_product_order(user_confirmed=false) → place_product_order(user_confirmed=true).\n"
            "- get_community_groups / get_community_posts / get_post_comments / create_community_post / create_post_comment / reply_to_post_comment / like_community_post: community flow.\n"
            "- All confirm-step tools: call with user_confirmed=false first (show card), then user_confirmed=true when confirmed.\n"
            "- Reuse recent context for follow-ups. Never ask the user to repeat what they just said.\n\n"
            "STYLE: Two short paragraphs max per response. First: what you found/did. Second: natural next-step question.\n"
            "Don't restate card contents in text. Use 'I checked/found/pulled/prepared' language.\n"
            "When response cards are available, keep text minimal — let the UI carry the detail."
        )

        context_lines = self.build_context_lines(payload)
        if context_lines:
            prompt = f"{prompt}\n\nKnown context:\n- " + "\n- ".join(context_lines)

        return prompt

    def build_history_items(self, payload: ChatRequest) -> list[dict[str, Any]]:
        if not payload.conversation:
            return []
        items: list[dict[str, Any]] = []
        for item in payload.conversation.recent_messages[-self.settings.gemini_history_message_limit:]:
            role = self.normalize_role(item.role)
            content = self.trim_history_content(item.content)
            if not content:
                continue
            items.append({"role": role, "content": content})
        return items

    def extract_memory_items(self, payload: ChatRequest) -> list[MemoryItem]:
        text = payload.message.lower()
        extracted: list[MemoryItem] = []
        for rule in MEMORY_RULES:
            if not self.match_memory_rule(text, rule):
                continue
            extracted.append(MemoryItem(
                category=rule["category"], key=rule["key"],
                value=rule["value"], confidence=rule["confidence"], isActive=True,
            ))
        return extracted

    def build_tools(self) -> list[dict[str, Any]]:
        schemas = self.registry.get_tool_schemas()
        return [
            {"name": s["name"], "description": s["description"], "parameters": s["parameters"]}
            for s in schemas
        ]

    def _make_model(self, system_prompt: str) -> genai.GenerativeModel:
        return genai.GenerativeModel(
            model_name=self.settings.gemini_model,
            system_instruction=system_prompt,
            generation_config=genai.types.GenerationConfig(
                max_output_tokens=self.settings.gemini_max_output_tokens,
            ),
        )

    def _history_to_contents(self, history: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return [
            {"role": h["role"], "parts": [h["content"]]}
            for h in history
        ]

    def _user_message_content(self, message: str) -> list[dict[str, Any]]:
        return [{"role": "user", "parts": [message]}]

    @staticmethod
    def _extract_text(response: Any) -> str:
        if not response.candidates:
            return ""
        c = response.candidates[0]
        if not c.content or not c.content.parts:
            return ""
        return "".join(p.text for p in c.content.parts if hasattr(p, "text") and p.text)

    def _extract_tool_calls(self, response: Any) -> list[MockToolCall]:
        calls: list[MockToolCall] = []
        if not response.candidates:
            return calls
        c = response.candidates[0]
        if not c.content or not c.content.parts:
            return calls
        for part in c.content.parts:
            fc = getattr(part, "function_call", None)
            if fc is None:
                continue
            calls.append(MockToolCall(
                call_id=str(uuid4()),
                name=fc.name,
                arguments=json.dumps(dict(fc.args) if fc.args else {}),
            ))
        return calls

    def create_initial_response(self, payload: ChatRequest) -> Any:
        system_prompt = self.build_system_prompt(payload)
        tool_decls = self.build_tools()
        model = self._make_model(system_prompt)
        history = self.build_history_items(payload)

        contents = self._history_to_contents(history) + self._user_message_content(payload.message)

        response = model.generate_content(
            contents=contents,
            tools=[{"function_declarations": tool_decls}] if tool_decls else None,
        )

        text = self._extract_text(response)
        tool_calls = self._extract_tool_calls(response)

        return MockResponse(getattr(response, "name", str(uuid4())), text, tool_calls)

    def create_followup_response(
        self,
        payload: ChatRequest,
        previous_response_id: str,
        tool_outputs: list[dict[str, Any]],
    ) -> Any:
        system_prompt = self.build_system_prompt(payload)
        model = self._make_model(system_prompt)
        history = self.build_history_items(payload)

        contents = self._history_to_contents(history) + self._user_message_content(payload.message)

        for out in tool_outputs:
            contents.append({
                "role": "model",
                "parts": [{"function_call": {"name": out["call_id"], "args": json.loads(out["output"])}}],
            })

        response = model.generate_content(contents=contents)

        text = self._extract_text(response)
        tool_calls = self._extract_tool_calls(response)

        return MockResponse(getattr(response, "name", str(uuid4())), text, tool_calls)

    @staticmethod
    def parse_tool_arguments(arguments: str) -> dict[str, Any]:
        if not arguments:
            return {}
        try:
            parsed = json.loads(arguments)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Invalid tool arguments JSON: {arguments}") from exc
        if not isinstance(parsed, dict):
            raise ValueError("Tool arguments must decode to an object.")
        return parsed

    async def create_streaming_response(self, payload: ChatRequest) -> AsyncGenerator[Any, None]:
        system_prompt = self.build_system_prompt(payload)
        tool_decls = self.build_tools()
        model = self._make_model(system_prompt)
        history = self.build_history_items(payload)

        contents = self._history_to_contents(history) + self._user_message_content(payload.message)

        response_id = f"chatcmpl-{uuid4()}"
        stream = model.generate_content(
            contents=contents,
            tools=[{"function_declarations": tool_decls}] if tool_decls else None,
            stream=True,
        )

        accumulated_tool_calls: dict[int, dict[str, str]] = {}
        accumulated_text = ""

        for chunk in stream:
            if chunk.candidates and chunk.candidates[0].content and chunk.candidates[0].content.parts:
                for part in chunk.candidates[0].content.parts:
                    if hasattr(part, "text") and part.text:
                        accumulated_text += part.text
                        yield _StreamChunk(part.text, response_id)
                    elif hasattr(part, "function_call"):
                        fc = part.function_call
                        idx = len(accumulated_tool_calls)
                        accumulated_tool_calls[idx] = {
                            "id": str(uuid4()),
                            "name": fc.name,
                            "arguments": json.dumps(dict(fc.args) if fc.args else {}),
                        }

        if accumulated_tool_calls:
            for tc in sorted(accumulated_tool_calls.values(), key=lambda x: x["id"]):
                item = MockItem(tc["name"], tc["arguments"], tc["id"])
                yield MockDoneChunk(item, response_id)
        else:
            pass

    async def create_streaming_followup(
        self,
        payload: ChatRequest,
        previous_response_id: str,
        tool_outputs: list[dict[str, Any]],
    ) -> AsyncGenerator[Any, None]:
        system_prompt = self.build_system_prompt(payload)
        model = self._make_model(system_prompt)
        history = self.build_history_items(payload)

        contents = self._history_to_contents(history) + self._user_message_content(payload.message)

        for out in tool_outputs:
            try:
                args = json.loads(out["output"]) if isinstance(out["output"], str) else out["output"]
            except (json.JSONDecodeError, TypeError):
                args = {"result": str(out["output"])}
            contents.append({
                "role": "model",
                "parts": [{"function_call": {"name": out["call_id"], "args": args}}],
            })

        stream = model.generate_content(contents=contents, stream=True)

        accumulated_text = ""
        for chunk in stream:
            if chunk.candidates and chunk.candidates[0].content and chunk.candidates[0].content.parts:
                for part in chunk.candidates[0].content.parts:
                    if hasattr(part, "text") and part.text:
                        accumulated_text += part.text
                        yield _StreamChunk(part.text)
