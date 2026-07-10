from __future__ import annotations

from datetime import datetime

from app.models.chat import ChatRequest

GENERIC_EVENT_TOKENS = {
    "show",
    "me",
    "list",
    "available",
    "upcoming",
    "event",
    "events",
    "any",
    "what",
    "which",
    "are",
    "is",
    "there",
    "can",
    "you",
    "tell",
    "find",
    "for",
    "the",
    "all",
    "only",
    "free",
    "paid",
    "ones",
    "one",
    "this",
    "that",
    "these",
    "two",
    "compare",
    "better",
    "best",
}

ORDINAL_WORDS = {
    "first": 0,
    "1st": 0,
    "one": 0,
    "second": 1,
    "2nd": 1,
    "two": 1,
    "third": 2,
    "3rd": 2,
    "three": 2,
    "fourth": 3,
    "4th": 3,
    "four": 3,
    "fifth": 4,
    "5th": 4,
    "five": 4,
}


def normalize_text(value: str | None) -> str:
    return " ".join(str(value or "").lower().replace("?", " ").replace(",", " ").split())


def to_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def is_weekend(value: str | None) -> bool:
    parsed = to_datetime(value)
    if not parsed:
        return False
    return parsed.weekday() >= 5


def format_focus_label(focus: str | None) -> str:
    text = normalize_text(focus)
    return text.replace("_", " ").title() if text else "General Fit"


def extract_ordinal_indices(text: str | None) -> list[int]:
    indices: list[int] = []
    for token in normalize_text(text).split():
        if token in ORDINAL_WORDS:
            index = ORDINAL_WORDS[token]
            if index not in indices:
                indices.append(index)
    return indices


def extract_recent_event_items(payload: ChatRequest) -> list[dict[str, object]]:
    conversation = payload.conversation
    if not conversation:
        return []

    for message in reversed(conversation.recent_messages):
        if message.role != "tool" or message.toolName not in {
            "search_events",
            "get_my_event_registrations",
            "compare_events",
            "get_event_details",
        }:
            continue

        tool_payload = message.toolPayload or {}
        result = tool_payload.get("result") if isinstance(tool_payload, dict) else None
        data = result.get("data") if isinstance(result, dict) else None
        if not isinstance(data, dict):
            continue

        if isinstance(data.get("items"), list):
            return [item for item in data["items"] if isinstance(item, dict)]

        if isinstance(data.get("event"), dict):
            return [data["event"]]

    return []


def is_broad_event_query(query: str, message_text: str) -> bool:
    normalized = normalize_text(query or message_text)
    if not normalized:
        return True

    broad_queries = {
        "event",
        "events",
        "free event",
        "free events",
        "paid event",
        "paid events",
        "show events",
        "show me events",
        "show me free events",
        "show me paid events",
        "list events",
        "available events",
        "upcoming events",
        "show upcoming events",
        "what events are available",
        "what events are there",
        "any events",
        "tell me events",
        "find events",
    }
    if normalized in broad_queries:
        return True

    tokens = [token for token in normalized.split() if token]
    return bool(tokens) and all(token in GENERIC_EVENT_TOKENS for token in tokens)


def wants_free_only(text: str) -> bool:
    normalized = normalize_text(text)
    return "free" in normalized and "paid" not in normalized


def wants_paid_only(text: str) -> bool:
    normalized = normalize_text(text)
    return any(marker in normalized for marker in ("paid", "ticketed", "payment")) and "free" not in normalized


def wants_beginner_recommendation(text: str) -> bool:
    normalized = normalize_text(text)
    keywords = (
        "beginner",
        "beginners",
        "new user",
        "new users",
        "new to",
        "just starting",
        "start with",
        "best event",
        "which event is best",
        "suitable for me",
    )
    return any(keyword in normalized for keyword in keywords)


def extract_audience_focus(text: str) -> str | None:
    normalized = normalize_text(text)
    if any(word in normalized for word in ("beginner", "beginners", "new user", "just starting")):
        return "beginners"
    if any(word in normalized for word in ("families", "family", "kids", "children", "parents")):
        return "families"
    if any(word in normalized for word in ("working professionals", "professionals", "office", "working people")):
        return "working_professionals"
    if any(word in normalized for word in ("value", "more value", "worth it", "worth more", "cheaper")):
        return "value"
    return None


def clean_search_query(query: str, message_text: str) -> str | None:
    base = normalize_text(query or message_text)
    if not base:
        return None
    cleaned_tokens = [token for token in base.split() if token not in GENERIC_EVENT_TOKENS]
    return " ".join(cleaned_tokens) or None


def score_beginner_friendliness(item: dict[str, object]) -> tuple[int, int]:
    title = normalize_text(str(item.get("title") or ""))
    description = normalize_text(str(item.get("description") or ""))
    category = normalize_text(str(item.get("category") or ""))
    text = " ".join(part for part in (title, description, category) if part)
    score = 0

    positive_markers = {
        "beginner": 5,
        "beginners": 5,
        "intro": 4,
        "introduction": 4,
        "foundational": 4,
        "basic": 3,
        "guided": 2,
        "meditation": 1,
        "circle": 1,
        "q&a": 1,
    }
    caution_markers = {
        "advanced": -5,
        "intensive": -4,
        "teacher training": -6,
        "deep dive": -3,
    }
    for phrase, weight in positive_markers.items():
        if phrase in text:
            score += weight
    for phrase, weight in caution_markers.items():
        if phrase in text:
            score += weight

    return score, 1 if not bool(item.get("is_paid")) else 0


def score_event_for_focus(item: dict[str, object], focus: str | None) -> tuple[int, int, int]:
    normalized_focus = normalize_text(focus)
    title = normalize_text(str(item.get("title") or ""))
    description = normalize_text(str(item.get("description") or ""))
    category = normalize_text(str(item.get("category") or ""))
    location_type = normalize_text(str(item.get("location_type") or ""))
    text = " ".join(part for part in (title, description, category, location_type) if part)
    price = item.get("price")
    numeric_price = price if isinstance(price, (int, float)) else 0
    weekend_score = 1 if is_weekend(str(item.get("event_date") or "")) else 0
    is_online = 1 if "online" in location_type else 0
    is_free = 1 if not bool(item.get("is_paid")) else 0

    if normalized_focus == "beginners":
        beginner_score, free_bonus = score_beginner_friendliness(item)
        return beginner_score, free_bonus, weekend_score

    if normalized_focus == "families":
        score = 0
        if any(term in text for term in ("family", "parent", "kids", "children", "q&a", "circle")):
            score += 5
        if weekend_score:
            score += 2
        if is_free:
            score += 1
        return score, weekend_score, is_free

    if normalized_focus == "working_professionals":
        score = 0
        if is_online:
            score += 4
        if weekend_score:
            score += 3
        if any(term in text for term in ("evening", "weekend", "restorative", "wellness", "retreat")):
            score += 2
        return score, is_online, -int(numeric_price)

    if normalized_focus == "value":
        score = 0
        if is_free:
            score += 10
        if any(term in text for term in ("retreat", "weekend", "group practice", "guided", "journaling")):
            score += 3
        return score, -int(numeric_price), weekend_score

    return 0, is_free, -int(numeric_price)


def message_tokens_for_matching(message_text: str) -> list[str]:
    return [
        token
        for token in normalize_text(message_text).split()
        if token not in GENERIC_EVENT_TOKENS and token not in ORDINAL_WORDS
    ]


def match_items_by_message_tokens(items: list[dict[str, object]], message_text: str) -> list[dict[str, object]]:
    tokens = message_tokens_for_matching(message_text)
    if not tokens:
        return items

    matched: list[dict[str, object]] = []
    for item in items:
        haystack = " ".join(
            normalize_text(str(item.get(field) or ""))
            for field in ("title", "description", "category", "location", "location_type")
        )
        if all(token in haystack for token in tokens):
            matched.append(item)
    return matched or items


def apply_recent_followup_filter(
    recent_items: list[dict[str, object]],
    message_text: str,
) -> tuple[list[dict[str, object]], str | None]:
    if not recent_items:
        return [], None

    normalized = normalize_text(message_text)

    if "after this" in normalized and len(recent_items) >= 2:
        return [recent_items[1]], "Selected the next event after the current one from the recent list."

    ordinal_indices = extract_ordinal_indices(message_text)
    if len(ordinal_indices) == 1 and 0 <= ordinal_indices[0] < len(recent_items):
        selected = [recent_items[ordinal_indices[0]]]
        return selected, f"Selected the {ordinal_indices[0] + 1} event from the recent list."

    filtered = recent_items
    note_parts: list[str] = []

    if wants_free_only(message_text):
        filtered = [item for item in filtered if not bool(item.get("is_paid"))]
        note_parts.append("free")
    elif wants_paid_only(message_text):
        filtered = [item for item in filtered if bool(item.get("is_paid"))]
        note_parts.append("paid")

    if "weekend" in normalized:
        weekend_items = [item for item in filtered if is_weekend(str(item.get("event_date") or ""))]
        if weekend_items:
            filtered = weekend_items
            note_parts.append("weekend")

    matched_by_tokens = match_items_by_message_tokens(filtered, message_text)
    if matched_by_tokens != filtered:
        filtered = matched_by_tokens
        note_parts.append("keyword")

    if any(term in normalized for term in ("cheaper one", "cheapest", "lower price", "less expensive")) and filtered:
        filtered = sorted(
            filtered,
            key=lambda item: item.get("price") if isinstance(item.get("price"), (int, float)) else 0,
        )
        return [filtered[0]], "Selected the lower-priced event from the recent list."

    if len(filtered) == 1:
        return filtered, "Matched a specific event from the recent list."

    if filtered and filtered != recent_items:
        return filtered, f"Filtered the recent event list to the most relevant {', '.join(note_parts) or 'matching'} options."

    return [], None


def resolve_single_event_reference(
    payload: ChatRequest,
    event_id: str | None,
    event_title: str | None,
    message_text: str,
) -> tuple[str | None, str | None]:
    normalized_id = str(event_id or "").strip() or None
    normalized_title = str(event_title or "").strip() or None
    if normalized_id:
        return normalized_id, normalized_title

    recent_items = extract_recent_event_items(payload)
    if not recent_items:
        return None, normalized_title

    ordinal_indices = extract_ordinal_indices(message_text)
    if len(ordinal_indices) == 1 and 0 <= ordinal_indices[0] < len(recent_items):
        item = recent_items[ordinal_indices[0]]
        return str(item.get("id") or item.get("event_id") or ""), str(item.get("title") or item.get("event_title") or "")

    filtered_items, _ = apply_recent_followup_filter(recent_items, message_text)
    if len(filtered_items) == 1:
        item = filtered_items[0]
        return str(item.get("id") or item.get("event_id") or ""), str(item.get("title") or item.get("event_title") or "")

    if normalized_title:
        lowered_title = normalized_title.lower()
        for item in recent_items:
            title = str(item.get("title") or item.get("event_title") or "").strip()
            if title and title.lower() == lowered_title:
                return str(item.get("id") or item.get("event_id") or ""), title
        for item in recent_items:
            title = str(item.get("title") or item.get("event_title") or "").strip()
            if title and lowered_title in title.lower():
                return str(item.get("id") or item.get("event_id") or ""), title

    if len(recent_items) == 1:
        item = recent_items[0]
        return str(item.get("id") or item.get("event_id") or ""), str(item.get("title") or item.get("event_title") or "")

    return None, normalized_title


def resolve_event_pair(
    payload: ChatRequest,
    first_event_id: str | None,
    second_event_id: str | None,
    first_event_title: str | None,
    second_event_title: str | None,
    message_text: str,
) -> tuple[list[dict[str, object]], str | None]:
    recent_items = extract_recent_event_items(payload)
    if not recent_items:
        return [], None

    resolved: list[dict[str, object]] = []
    requested_ids = [first_event_id, second_event_id]
    requested_titles = [first_event_title, second_event_title]

    for requested_id in requested_ids:
        normalized_id = str(requested_id or "").strip()
        if not normalized_id:
            continue
        for item in recent_items:
            if str(item.get("id") or item.get("event_id") or "").strip() == normalized_id:
                if item not in resolved:
                    resolved.append(item)
                break

    for requested_title in requested_titles:
        normalized_title = str(requested_title or "").strip().lower()
        if not normalized_title:
            continue
        for item in recent_items:
            title = str(item.get("title") or item.get("event_title") or "").strip()
            if title and normalized_title in title.lower():
                if item not in resolved:
                    resolved.append(item)
                break

    ordinal_indices = extract_ordinal_indices(message_text)
    for index in ordinal_indices:
        if 0 <= index < len(recent_items):
            item = recent_items[index]
            if item not in resolved:
                resolved.append(item)

    if len(resolved) >= 2:
        return resolved[:2], "Compared the two events referenced from recent context."

    normalized_message = normalize_text(message_text)
    if any(
        phrase in normalized_message
        for phrase in ("compare these two", "compare both", "these two events", "both events")
    ) and len(recent_items) >= 2:
        return recent_items[:2], "Compared the first two events from the recent list."

    return resolved[:2], None
