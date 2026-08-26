import json
from typing import Any, AsyncGenerator

from openai import AsyncOpenAI, OpenAI

from app.core.config import get_settings
from app.core.exceptions import ConfigurationError
from app.models.chat import ChatRequest, MemoryItem
from app.tools.registry import ToolRegistry

MemoryRule = dict[str, Any]

MEMORY_RULES: tuple[MemoryRule, ...] = (
    {
        "terms": ("beginner",),
        "category": "learning",
        "key": "experience_level",
        "value": "beginner",
        "confidence": 0.82,
        "match": "any",
    },
    {
        "terms": ("meditation",),
        "category": "goal",
        "key": "interest_topic",
        "value": "meditation",
        "confidence": 0.74,
        "match": "any",
    },
    {
        "terms": ("membership", "plan"),
        "category": "goal",
        "key": "interest_area",
        "value": "membership_guidance",
        "confidence": 0.68,
        "match": "any",
    },
    {
        "terms": ("short answer", "reply shortly", "concise"),
        "category": "preference",
        "key": "response_style",
        "value": "concise",
        "confidence": 0.9,
        "match": "any",
    },
    {
        "terms": ("hindi",),
        "category": "preference",
        "key": "language_preference",
        "value": "hindi",
        "confidence": 0.88,
        "match": "any",
    },
    {
        "terms": ("free events", "free event", "free ones"),
        "category": "preference",
        "key": "event_price_preference",
        "value": "free",
        "confidence": 0.8,
        "match": "any",
    },
    {
        "terms": ("paid events", "paid event", "premium events"),
        "category": "preference",
        "key": "event_price_preference",
        "value": "paid",
        "confidence": 0.74,
        "match": "any",
    },
    {
        "terms": ("online events", "online event", "online sessions"),
        "category": "preference",
        "key": "event_format_preference",
        "value": "online",
        "confidence": 0.81,
        "match": "any",
    },
    {
        "terms": ("meditation retreats", "meditation retreat"),
        "category": "preference",
        "key": "event_style_preference",
        "value": "meditation_retreat",
        "confidence": 0.78,
        "match": "any",
    },
    {
        "terms": ("beginner events", "beginner event"),
        "category": "preference",
        "key": "event_audience_preference",
        "value": "beginner",
        "confidence": 0.79,
        "match": "any",
    },
)


class OpenAIService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.registry = ToolRegistry()
        if not self.settings.openai_api_key:
            raise ConfigurationError("OPENAI_API_KEY is not configured.")
        self.client = OpenAI(api_key=self.settings.openai_api_key)
        self.async_client = AsyncOpenAI(api_key=self.settings.openai_api_key)

    @staticmethod
    def normalize_role(role: str) -> str:
        return role if role in {"user", "assistant"} else "assistant"

    def trim_history_content(self, content: str) -> str:
        cleaned = content.strip()
        if not cleaned:
            return ""
        if len(cleaned) <= self.settings.openai_history_char_limit:
            return cleaned
        return cleaned[: self.settings.openai_history_char_limit].rstrip() + "..."

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
            (
                "Conversation summary",
                payload.conversation.summary if payload.conversation else None,
            ),
        ]
        context_lines = [
            f"{label}: {value}" for label, value in raw_context_items if value
        ]

        active_memory = [
            f"{item.key}={item.value}"
            for item in payload.memory[: self.settings.openai_memory_item_limit]
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

                if item.toolName == "search_events" and isinstance(data, dict):
                    event_items = data.get("items") or []
                    if isinstance(event_items, list) and event_items:
                        event_bits = []
                        for event in event_items[:3]:
                            if not isinstance(event, dict):
                                continue
                            event_id = event.get("id") or event.get("event_id")
                            title = event.get("title") or event.get("event_title")
                            if title:
                                if event_id:
                                    event_bits.append(f"{title} ({event_id})")
                                else:
                                    event_bits.append(str(title))
                        if event_bits:
                            line = "Recent event results: " + "; ".join(event_bits)
                elif item.toolName == "get_my_event_registrations" and isinstance(data, dict):
                    registrations = data.get("items") or []
                    if isinstance(registrations, list) and registrations:
                        reg_bits = []
                        for reg in registrations[:3]:
                            if not isinstance(reg, dict):
                                continue
                            event_id = reg.get("event_id")
                            title = reg.get("event_title")
                            if title:
                                if event_id:
                                    reg_bits.append(f"{title} ({event_id})")
                                else:
                                    reg_bits.append(str(title))
                        if reg_bits:
                            line = "Recent registered events: " + "; ".join(reg_bits)
                elif item.toolName in {"search_courses", "get_my_enrollments", "get_continue_learning", "compare_courses", "play_current_lesson"} and isinstance(data, dict):
                    course_items = data.get("items") or []
                    if isinstance(course_items, list) and course_items:
                        course_bits = []
                        for course in course_items[:3]:
                            if not isinstance(course, dict):
                                continue
                            course_id = course.get("id") or course.get("course_id")
                            title = course.get("title") or course.get("course_title")
                            if title:
                                if course_id:
                                    course_bits.append(f"{title} ({course_id})")
                                else:
                                    course_bits.append(str(title))
                        if course_bits:
                            line = "Recent course results: " + "; ".join(course_bits)
                elif item.toolName == "get_my_counseling_bookings" and isinstance(data, dict):
                    bookings = data.get("bookings") or []
                    if isinstance(bookings, list) and bookings:
                        booking_bits = []
                        for b in bookings[:5]:
                            if not isinstance(b, dict):
                                continue
                            b_id = b.get("id")
                            c_type = b.get("counselor_type") or "Counseling Session"
                            date = b.get("booking_date")
                            time = b.get("booking_time")
                            status = b.get("status")
                            if b_id:
                                booking_bits.append(f"{c_type} on {date} at {time} ({status}) [ID: {b_id}]")
                        if booking_bits:
                            line = "Recent counseling bookings: " + "; ".join(booking_bits)
                elif item.toolName == "check_counselor_availability" and isinstance(data, dict):
                    slots = data.get("slots") or []
                    date = data.get("date")
                    c_type = data.get("counselor_type") or "General"
                    if slots:
                        line = f"Available slots for {c_type} on {date}: " + ", ".join(slots[:6])
                elif item.toolName in {"book_counseling_session", "cancel_counseling_booking"} and isinstance(data, dict):
                    b_id = data.get("booking_id")
                    c_type = data.get("counselor_type")
                    date = data.get("booking_date")
                    time = data.get("booking_time")
                    action = data.get("action")
                    line = f"Counseling tool action: tool={item.toolName}, action={action}, service={c_type}, date={date}, time={time}"
                    if b_id:
                        line += f", booking_id={b_id}"
                elif item.toolName == "search_podcasts" and isinstance(data, dict):
                    podcasts = data.get("items") or []
                    if isinstance(podcasts, list) and podcasts:
                        pod_bits = []
                        for pod in podcasts[:4]:
                            if not isinstance(pod, dict):
                                continue
                            p_id = pod.get("id")
                            title = pod.get("title")
                            host = pod.get("host")
                            if title:
                                pod_bits.append(f"{title} by {host} [ID: {p_id}]")
                        if pod_bits:
                            line = "Recent podcasts found: " + "; ".join(pod_bits)
                elif item.toolName == "play_podcast" and isinstance(data, dict):
                    action = data.get("action")
                    pod = data.get("podcast") or {}
                    p_id = data.get("podcast_id") or pod.get("id")
                    title = pod.get("title") or "podcast"
                    line = f"Podcast playback status: action={action}, title='{title}'"
                    if p_id:
                        line += f", podcast_id={p_id}"
                elif item.toolName == "search_products" and isinstance(data, dict):
                    products = data.get("items") or []
                    if isinstance(products, list) and products:
                        prod_bits = []
                        for prod in products[:5]:
                            if not isinstance(prod, dict):
                                continue
                            p_id = prod.get("id")
                            name = prod.get("name")
                            price = prod.get("price")
                            if name:
                                prod_bits.append(f"{name} [ID: {p_id}, Price: {price}]")
                        if prod_bits:
                            line = "Recent products found: " + "; ".join(prod_bits)
                elif item.toolName in {"get_saved_addresses", "add_address"} and isinstance(data, dict):
                    address_list = data.get("items") or []
                    if not address_list and "address" in data:
                        address_list = [data["address"]]
                    elif not address_list and "id" in data:
                        address_list = [data]
                    if isinstance(address_list, list) and address_list:
                        addr_bits = []
                        for addr in address_list:
                            if not isinstance(addr, dict):
                                continue
                            a_id = addr.get("id")
                            label = addr.get("type") or "home"
                            name = addr.get("fullName") or "Address"
                            line1 = addr.get("addressLine1") or ""
                            city = addr.get("city") or ""
                            if a_id:
                                addr_bits.append(f"{name} - {line1}, {city} ({label}) [ID: {a_id}]")
                        if addr_bits:
                            line = "Saved delivery addresses: " + "; ".join(addr_bits)
                elif item.toolName == "place_product_order" and isinstance(data, dict):
                    action = data.get("action")
                    order_id = data.get("order_id")
                    order_number = data.get("order_number")
                    payment_link_id = data.get("payment_link_id")
                    line = f"Recent order placed: action={action}, order_id={order_id}, order_number={order_number}"
                    if payment_link_id:
                        line += f", payment_link_id={payment_link_id}"
                elif item.toolName == "confirm_order_payment" and isinstance(data, dict):
                    action = data.get("action")
                    order_id = data.get("order_id")
                    order_number = data.get("order_number")
                    line = f"Payment confirmation status: action={action}, order_id={order_id}, order_number={order_number}"
                elif item.toolName == "request_address_form" and isinstance(data, dict):
                    line = "Opened interactive address entry form."
                elif item.toolName == "get_community_groups" and isinstance(data, dict):
                    flat_groups = data.get("groups") or []
                    group_bits = []
                    for g in flat_groups:
                        if not isinstance(g, dict):
                            continue
                        g_id = g.get("_id") or g.get("id")
                        name = g.get("name")
                        if name and g_id:
                            group_bits.append(f"{name} [ID: {g_id}]")
                    if group_bits:
                        line = "Available community groups: " + "; ".join(group_bits)
                elif item.toolName == "get_community_posts" and isinstance(data, dict):
                    posts = data.get("posts") or []
                    post_bits = []
                    for p in posts[:5]:
                        if not isinstance(p, dict):
                            continue
                        p_id = p.get("_id") or p.get("id")
                        content = p.get("content") or ""
                        truncated_content = content[:30] + "..." if len(content) > 30 else content
                        if p_id:
                            post_bits.append(f"Post '{truncated_content}' [ID: {p_id}]")
                    if post_bits:
                        line = "Recent group posts: " + "; ".join(post_bits)
                elif item.toolName == "get_post_comments" and isinstance(data, dict):
                    comments = data.get("comments") or []
                    comment_bits = []
                    for comment in comments[:4]:
                        if not isinstance(comment, dict):
                            continue
                        author = comment.get("author") or {}
                        author_name = str(author.get("displayName") or "Anonymous User").strip()
                        content = str(comment.get("content") or "").strip()
                        if not content:
                            continue
                        truncated_content = content[:48].rstrip()
                        if len(content) > 48:
                            truncated_content += "..."
                        comment_bits.append(f"{author_name}: '{truncated_content}'")
                    if comment_bits:
                        line = "Recent post comments: " + "; ".join(comment_bits)
                elif item.toolName == "create_community_post" and isinstance(data, dict):
                    group_name = str(data.get("group_name") or "community group").strip()
                    content = str(data.get("content") or "").strip()
                    action = str(data.get("action") or "").strip()
                    excerpt = self.trim_history_content(content) if content else "draft post"
                    line = f"Recent community post action: action={action}, group='{group_name}', content='{excerpt}'"
                elif item.toolName == "create_post_comment" and isinstance(data, dict):
                    post_content = str(data.get("post_content") or "selected post").strip()
                    reply_content = str(data.get("content") or "").strip()
                    action = str(data.get("action") or "").strip()
                    post_excerpt = self.trim_history_content(post_content)
                    reply_excerpt = self.trim_history_content(reply_content) if reply_content else "draft reply"
                    line = f"Recent post comment action: action={action}, post='{post_excerpt}', reply='{reply_excerpt}'"
                elif item.toolName == "like_community_post" and isinstance(data, dict):
                    action = str(data.get("action") or "").strip()
                    post_content = self.trim_history_content(str(data.get("post_content") or "selected post").strip())
                    line = f"Recent community like action: action={action}, post='{post_content}'"
                elif item.toolName == "reply_to_post_comment" and isinstance(data, dict):
                    action = str(data.get("action") or "").strip()
                    comment_excerpt = self.trim_history_content(str(data.get("comment_content") or "selected comment").strip())
                    reply_excerpt = self.trim_history_content(str(data.get("content") or "draft reply").strip())
                    line = f"Recent comment reply action: action={action}, comment='{comment_excerpt}', reply='{reply_excerpt}'"

                if not line and summary:
                    line = f"Recent tool result from {item.toolName}: {self.trim_history_content(str(summary))}"

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
        summary_parts: list[str] = []

        if recent_user_focus:
            summary_parts.append(
                "Recent user focus: " + " | ".join(self.trim_history_content(item) for item in recent_user_focus)
            )

        active_memory = [
            f"{item.key}={item.value}"
            for item in payload.memory[: self.settings.openai_memory_item_limit]
            if item.isActive
        ]
        if active_memory:
            summary_parts.append("Persistent context: " + "; ".join(active_memory))

        answer_snippet = self.trim_history_content(answer)
        if answer_snippet:
            summary_parts.append("Latest assistant direction: " + answer_snippet)

        if not summary_parts:
            return None

        return " || ".join(summary_parts)[:1500]

    def build_system_prompt(self, payload: ChatRequest) -> str:
        prompt = (
            "You are the ParamSukh in-app AI guide. "
            "Help users with courses, memberships, events, podcasts, and learning progress. "
            "Use tools only when the answer depends on live app data or authenticated user data. "
            "For general guidance, answer directly without tools. "
            "If data is unavailable, say so clearly and do not invent details. "
            "Keep answers concise, practical, and easy to scan.\n\n"
            "Tool policy:\n"
            "- Use search_courses for course discovery, topic-based recommendations, and broad catalog listing.\n"
            "- For broad course asks like 'show me all courses', 'what courses are available', or 'list the courses on the platform', use search_courses immediately without asking the user for a topic first.\n"
            "- If the user is generally browsing courses, do not ask for a category unless they clearly want filtering or recommendations.\n"
            "- Use compare_courses when the user wants to compare two courses or asks which enrolled course to finish first, which one is closest to completion, which is shorter, deeper, or more beginner friendly.\n"
            "- For prompts like 'compare these two courses', 'which enrolled course should I finish first', 'which one is closest to completion', or 'which course should I complete next', prefer compare_courses over a plain text opinion.\n"
            "- Use recommend_courses when the user wants best-fit course suggestions, not just raw search results.\n"
            "- Use get_my_enrollments, get_continue_learning, and get_course_progress for user-specific learning state.\n"
            "- For prompts like 'show my enrolled courses', 'what courses am I doing', 'show my progress', or 'what have I completed', prefer get_my_enrollments first and let the structured learning UI carry the detail.\n"
            "- Use enroll_in_course only after the user explicitly confirms they want to join a specific course.\n"
            "- For course enrollment follow-ups like 'enroll me in this course', 'join the second one', or 'sign me up for that course', reuse recent course context instead of asking the user to repeat the course name.\n"
            "- If course enrollment is blocked by plan access, explain that clearly and offer the next membership step instead of pretending the course can be purchased directly.\n"
            "- Use play_current_lesson when the user wants to play, resume, open, or continue the current lesson from an enrolled course.\n"
            "- For prompts like 'play my current lesson', 'resume my course', 'open the next lesson', or 'continue where I left off in this course', prefer play_current_lesson over a plain text explanation.\n"
            "- Never imply lesson playback is available for a course unless enrollment has been verified first.\n"
            "- Use complete_course when the user asks to mark a course as completed, finished, or done. Call it immediately with user_confirmed=false to show the confirmation card UI — do not ask for confirmation in plain text first.\n"
            "- Once the user explicitly confirms (e.g., 'yes', 'confirm', 'do it', 'go ahead'), call complete_course again with user_confirmed=true to execute the completion.\n"
            "- For course completion follow-ups like 'mark this course complete', 'I finished it', or 'mark it as done', reuse recent course context or resolve the course by name from the user's active enrollments — do not ask the user to repeat the course name.\n"
            "- Use get_membership_plans and get_my_subscription for plan questions.\n"
            "- Use start_membership_purchase only after the user explicitly confirms they want to buy a specific plan.\n"
            "- Use search_events for broad event discovery, free-versus-paid listings, filtered follow-ups, and event recommendations.\n"
            "- For broad event asks like 'show me events', 'what events are available', or 'any upcoming events', use search_events immediately without asking for a category, and prefer listing available upcoming events grouped into paid and free.\n"
            "- For event follow-ups like 'show me only free ones', 'the cheaper one', 'the weekend one', 'the Rishikesh one', 'the one after this', or 'register me for the second one', reuse recent event-list context instead of asking the user to repeat event names or categories.\n"
            "- Use compare_events when the user wants to compare two events or asks which event is better for beginners, families, working professionals, or overall value.\n"
            "- For prompts like 'compare these two', 'which one is better', 'which paid event gives more value', or 'which is better for beginners', prefer compare_events over a plain text comparison.\n"
            "- Use get_event_details when the user asks what to bring, when it starts, whether registration went through, ticket-related details, or other event-specific follow-up questions.\n"
            "- Use get_my_event_registrations for user-specific booked events, upcoming bookings, or registration history.\n"
            "- Use register_for_event only after explicit user confirmation to proceed with a specific event.\n"
            "- Before registering, prefer confirming event availability, user status, and recent context through tools rather than making assumptions.\n"
            "- Use cancel_event_registration only after explicit user confirmation to cancel a specific event registration.\n"
            "- When the user says 'this event', 'that event', 'this course', or similar follow-up wording, use recent tool context instead of claiming the capability is unavailable.\n"
            "- Use search_podcasts for podcast discovery.\n"
            "- Use play_podcast when the user wants to play, listen to, or stream a specific podcast, mantra, or audio track. Always call play_podcast with user_confirmed=false first to show the playback confirmation card UI — do not ask for confirmation in plain text first.\n"
            "- Once the user explicitly confirms (e.g. 'yes', 'confirm', 'go ahead', 'play it'), call play_podcast again with user_confirmed=true to trigger playback.\n"
            "- Resolve the podcast title from recent search results or user history — do not ask the user to repeat the podcast name if they just listed or mentioned it.\n"
            "- Use search_support_content for FAQs, contact methods, and help guidance.\n"
            "- Use get_support_messages only when the user asks about their own support tickets.\n"
            "- Use search_counseling_services when the user asks about counseling, therapy, guidance sessions, spiritual sessions, relationship counseling, mental health support, or wants to know what counseling options are available.\n"
            "- For phrases like 'what counseling do you offer', 'therapy options', 'book a session', 'spiritual guidance session', or 'who can I talk to', call search_counseling_services immediately to show available services.\n"
            "- Use check_counselor_availability when the user asks about free slots, available times, 'when can I book a session', 'is there availability', or 'when is the counselor free'.\n"
            "- For availability checks, always pass the date as YYYY-MM-DD. Use the 'Today\'s date' and 'Tomorrow\'s date' values from Known context to resolve relative references like 'tomorrow', 'next Monday', 'this Friday', or 'this week' to the correct ISO date before calling the tool.\n"
            "- CRITICAL: When a user says 'tomorrow', 'for tomorrow', 'next week', or any relative date phrase as a follow-up to an availability question, immediately call check_counselor_availability with the resolved ISO date from Known context — do NOT search courses or ask again.\n"
            "- If the user says 'tomorrow' or 'for tomorrow', use the 'Tomorrow\'s date' value from Known context directly as the date parameter.\n"
            "- If the user asks for availability 'this week', check the nearest upcoming weekday first (use today or tomorrow from Known context).\n"
            "- When a user asks to check counselor availability but does not mention a specific date, assume they mean today or tomorrow (prefer tomorrow if it is past midday) and call check_counselor_availability immediately without asking for a date.\n"
            "- Use get_my_counseling_bookings when the user asks about their booked sessions, appointments, 'when is my booking', or schedule.\n"
            "- Use book_counseling_session when the user wants to book, schedule, or confirm a slot. Always call book_counseling_session with user_confirmed=false first to show the confirmation card UI — do not ask for confirmation in plain text first.\n"
            "- Once the user explicitly confirms (e.g. 'yes', 'confirm', 'go ahead', 'do it'), call book_counseling_session again with user_confirmed=true to execute the booking.\n"
            "- Resolve counselor_type, booking_date, and booking_time from recent slots checked or user history — do not ask the user to repeat slot details if they were just listed.\n"
            "- Use cancel_counseling_booking when the user wants to cancel a booking. Call it with user_confirmed=false first to show the cancellation confirmation card UI — do not ask for confirmation in plain text first.\n"
            "- Once the user explicitly confirms (e.g. 'yes', 'confirm', 'do it'), call cancel_counseling_booking again with user_confirmed=true to execute the cancellation.\n"
            "- Use get_daily_guidance when the user requests a daily quote, daily affirmation, daily horoscope, mood-based guidance, or general daily spiritual check-in. Try to resolve the user's current mood and/or zodiac sign from user input or context where possible.\n"
            "- Use search_products when the user is searching for physical items, books, accessories, spiritual items, or looking to browse the ParamSukh shop. Try to resolve search queries, categories, and price limits from user questions where specified.\n"
            "- For search_products: Never pass generic search keywords like 'available', 'products', 'items', 'all', or 'shop' as the 'search' parameter. If the user asks to browse all products, show available products, or list shop items generally, omit the 'search' parameter entirely (do not pass it at all).\n"
            "- For search_products: Never set 'in_stock' to true unless the user explicitly says 'in stock only', 'only available', or specifically asks to filter by stock. The word 'available' in a general question like 'show available products' does NOT mean in_stock filter.\n"
            "- For search_products: Never pass 0 for min_price, max_price, or rating. Only pass these if the user explicitly specifies a price range or rating threshold. Omit them otherwise.\n"
            "- Use strict step-by-step Interactive Purchase Flow when a user wants to buy/purchase a product:\n"
            "  1. Ask for Quantity: Ask the user 'What quantity would you like to purchase?' first, and wait for their response before calling any tools.\n"
            "CRITICAL RESPONSE FORMAT RULE: When a tool execution yields structured card results (such as lists, summaries, progress cards), you MUST write your text response as exactly two short paragraphs separated by a double newline (\\n\\n). The first paragraph must be a single concise framing sentence summarizing what you checked or found. The second paragraph must be a single natural follow-up question or helpful suggestion for the next step. Do NOT combine them into one paragraph, and do NOT use text bullet lists.\n"
            "  2. Address Resolution: Once quantity is known, call get_saved_addresses. If they have saved addresses, show them the address list and ask: 'Do you want to deliver to one of these addresses, or somewhere else?'. If they have no saved addresses or choose 'somewhere else' (or say 'add new address' / 'deliver to a new location'), call request_address_form immediately to show them the interactive address form card. Do NOT ask them to type their address in plain text first.\n"
            "  3. Ask for Payment Method: Once the address is selected or added, ask the user: 'Would you like to pay using Cash on Delivery (COD) or Online Payment (Razorpay)?'. Wait for their response.\n"
            "  4. Checkout Summary Preview: Once the payment method is chosen, call place_product_order with user_confirmed=false, product_id, product_name, product_price, quantity, address_id, and payment_method to show the checkout summary card. Ask the user to confirm the order details.\n"
            "  5. Order Execution: Once the user explicitly confirms (e.g. 'yes', 'confirm', 'place order', 'do it'), call place_product_order again with user_confirmed=true to place the order.\n"
            "- Use get_my_orders when the user asks about their recent purchases, order history, or tracking status.\n"
            "- Use request_address_form when the user chooses to add a new address, deliver to a new location, deliver somewhere else, or asks you to open the address form. Call it immediately to present the form card UI. Do not ask for details in plain text.\n"
            "- Use confirm_order_payment when the user indicates they have completed their online payment, paid successfully, or requests you to check/verify their payment status for an online order. Call it immediately with order_id and payment_link_id. Do not ask for confirmation first.\n"
            "- Use cancel_order when the user wants to cancel an order. Call it with user_confirmed=false first to show the cancellation preview card. Once the user confirms, call it with user_confirmed=true to execute the cancellation. You can pass the order number (e.g., ORD2607600502) as the order_id if you do not have the database ObjectId, as the backend supports both. If the user asks to cancel all orders, query get_my_orders first to list them all and then cancel them one by one. Do not ask for confirmation in plain text first.\n"
            "- Use get_community_groups when the user requests to see their active groups, communities, discussion circles, or asks about community access.\n"
            "- Use get_community_posts when the user wants to view the discussion feed, latest posts, or what is happening in a community group.\n"
            "- For community follow-ups like 'show posts in this group', 'open the second group', 'show the latest discussions', or 'what is happening there', reuse recent community-group context instead of asking the user to repeat the group ID.\n"
            "- Use get_post_comments when the user wants the replies, comment thread, or discussion comments for a community post.\n"
            "- For follow-ups like 'show comments', 'open replies on this post', or 'what are people saying on the second post', reuse recent post context instead of asking the user to repeat the post ID.\n"
            "- Use create_community_post when the user wants to post, publish, share, or write an update inside a community group.\n"
            "- Always call create_community_post with user_confirmed=false first to show the post preview confirmation UI. Once the user explicitly confirms, call it again with user_confirmed=true.\n"
            "- For follow-ups like 'yes post it', 'publish this', or 'go ahead', reuse the recent create_community_post preview context instead of asking the user to repeat the group or post content.\n"
            "- Use create_post_comment when the user wants to reply, comment, respond, or add a message to a community post.\n"
            "- Always call create_post_comment with user_confirmed=false first to show the reply preview confirmation UI. Once the user explicitly confirms, call it again with user_confirmed=true.\n"
            "- For follow-ups like 'yes send it', 'post this reply', or 'go ahead with the comment', reuse the recent create_post_comment preview context instead of asking the user to repeat the post or reply text.\n"
            "- Use reply_to_post_comment when the user wants to reply to a specific comment inside a post thread, not just add a top-level comment on the post.\n"
            "- Always call reply_to_post_comment with user_confirmed=false first to show the reply preview confirmation UI. Once the user explicitly confirms, call it again with user_confirmed=true.\n"
            "- For follow-ups like 'reply to the second comment', 'answer what Aarav said', or 'yes send that comment reply', reuse recent comment-thread context instead of asking the user to repeat the comment id.\n"
            "- Use like_community_post when the user wants to like or unlike a community post.\n"
            "- For prompts like 'like this post', 'unlike that one', or 'remove my like', resolve the post from recent community context instead of claiming the capability is unavailable.\n"
            "- If a user asks a broad recommendation question and real app data is not required, answer directly first.\n"
            "- If a tool returns empty results, explain that clearly and offer the closest helpful next step.\n"
            "- When tool-backed structured results are available, keep the written answer brief and let the app UI cards carry the detailed listing.\n"
            "- Provide a clear, structured intro before tool results.\n"
            "- After describing results, provide a natural follow-up question or next helpful suggestion.\n"
            "- When the user query is ambiguous, ask a clarifying question instead of guessing.\n"
            "- For tool-backed replies with structured UI, write the answer as two short paragraphs: first a concise direct answer or framing sentence, then a natural follow-up question or next helpful suggestion.\n"
            "- Behave like a capable in-app agent, not a generic chatbot: be direct, calm, and decisive.\n"
            "- When structured UI is available, do not restate the full card contents in text. Summarize what you found, what you checked, or what happens next.\n"
            "- Prefer language that reflects completed reasoning such as 'I checked', 'I found', 'I pulled', or 'I prepared' when that is true from tool results.\n"
            "- Avoid robotic filler, long disclaimers, and repetitive tool narration.\n"
            "- Do not repeat the full course, event, membership, or podcast list in plain text when structured cards are available.\n"
            "- For event comparisons specifically, avoid long bullet explanations when comparison UI is available."
        )

        context_lines = self.build_context_lines(payload)
        if context_lines:
            prompt = f"{prompt}\n\nKnown context:\n- " + "\n- ".join(context_lines)

        return prompt

    def build_history_items(self, payload: ChatRequest) -> list[dict[str, Any]]:
        if not payload.conversation:
            return []

        history_items: list[dict[str, Any]] = []
        for item in payload.conversation.recent_messages[-self.settings.openai_history_message_limit :]:
            role = self.normalize_role(item.role)
            content = self.trim_history_content(item.content)
            if not content:
                continue
            history_items.append({"role": role, "content": content})

        return history_items

    def extract_memory_items(self, payload: ChatRequest) -> list[MemoryItem]:
        text = payload.message.lower()
        extracted: list[MemoryItem] = []

        for rule in MEMORY_RULES:
            if not self.match_memory_rule(text, rule):
                continue
            extracted.append(
                MemoryItem(
                    category=rule["category"],
                    key=rule["key"],
                    value=rule["value"],
                    confidence=rule["confidence"],
                    isActive=True,
                )
            )

        return extracted

    def build_tools(self) -> list[dict[str, Any]]:
        return self.registry.get_tool_schemas()

    def create_initial_response(self, payload: ChatRequest) -> Any:
        return self.client.responses.create(
            model=self.settings.openai_model,
            input=[
                {"role": "system", "content": self.build_system_prompt(payload)},
                *self.build_history_items(payload),
                {"role": "user", "content": payload.message},
            ],
            tools=self.build_tools(),
            max_output_tokens=self.settings.openai_max_output_tokens,
            parallel_tool_calls=False,
        )

    def create_followup_response(
        self,
        payload: ChatRequest,
        previous_response_id: str,
        tool_outputs: list[dict[str, Any]],
    ) -> Any:
        return self.client.responses.create(
            model=self.settings.openai_model,
            previous_response_id=previous_response_id,
            input=tool_outputs,
            max_output_tokens=self.settings.openai_max_output_tokens,
            parallel_tool_calls=False,
        )

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
        response = await self.async_client.responses.create(
            model=self.settings.openai_model,
            input=[
                {"role": "system", "content": self.build_system_prompt(payload)},
                *self.build_history_items(payload),
                {"role": "user", "content": payload.message},
            ],
            tools=self.build_tools(),
            max_output_tokens=self.settings.openai_max_output_tokens,
            parallel_tool_calls=False,
            stream=True,
        )
        async for chunk in response:
            yield chunk

    async def create_streaming_followup(
        self,
        payload: ChatRequest,
        previous_response_id: str,
        tool_outputs: list[dict[str, Any]],
    ) -> AsyncGenerator[Any, None]:
        response = await self.async_client.responses.create(
            model=self.settings.openai_model,
            previous_response_id=previous_response_id,
            input=tool_outputs,
            max_output_tokens=self.settings.openai_max_output_tokens,
            parallel_tool_calls=False,
            stream=True,
        )
        async for chunk in response:
            yield chunk
