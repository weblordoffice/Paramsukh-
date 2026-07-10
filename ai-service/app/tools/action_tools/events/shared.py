from __future__ import annotations

from datetime import datetime

from app.models.chat import ChatRequest

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

GENERIC_EVENT_TOKENS = {
    "show",
    "me",
    "event",
    "events",
    "this",
    "that",
    "these",
    "those",
    "the",
    "one",
    "ones",
    "for",
    "to",
    "of",
    "in",
    "on",
    "with",
    "please",
    "register",
    "book",
    "cancel",
    "unregister",
    "compare",
    "details",
    "tell",
    "about",
    "available",
    "upcoming",
    "can",
    "you",
    "get",
    "my",
    "want",
}


def normalize_text(value: str | None) -> str:
    return " ".join(
        str(value or "")
        .lower()
        .replace("?", " ")
        .replace(",", " ")
        .replace("-", " ")
        .split()
    )


def to_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def is_weekend(value: str | None) -> bool:
    parsed = to_datetime(value)
    return bool(parsed and parsed.weekday() >= 5)


def extract_ordinal_index(text: str | None) -> int | None:
    for token in normalize_text(text).split():
        if token in ORDINAL_WORDS:
            return ORDINAL_WORDS[token]
    return None


def extract_recent_event_candidates(payload: ChatRequest) -> list[dict[str, object]]:
    conversation = payload.conversation
    if not conversation:
        return []

    candidates: list[dict[str, object]] = []
    seen_ids: set[str] = set()

    for message in reversed(conversation.recent_messages):
        if message.role != "tool":
            continue
        if message.toolName not in {
            "search_events",
            "get_my_event_registrations",
            "compare_events",
            "get_event_details",
            "register_for_event",
            "cancel_event_registration",
        }:
            continue

        tool_payload = message.toolPayload or {}
        result = tool_payload.get("result") if isinstance(tool_payload, dict) else None
        data = result.get("data") if isinstance(result, dict) else None
        if not isinstance(data, dict):
            continue

        items: list[dict[str, object]] = []
        if isinstance(data.get("items"), list):
            items.extend(item for item in data["items"] if isinstance(item, dict))
        if isinstance(data.get("paid_items"), list):
            items.extend(item for item in data["paid_items"] if isinstance(item, dict))
        if isinstance(data.get("free_items"), list):
            items.extend(item for item in data["free_items"] if isinstance(item, dict))
        if isinstance(data.get("event"), dict):
            items.append(data["event"])

        for item in items:
            event_id = str(item.get("id") or item.get("event_id") or "").strip()
            if not event_id or event_id in seen_ids:
                continue
            seen_ids.add(event_id)
            candidates.append(
                {
                    "event_id": event_id,
                    "title": str(item.get("title") or item.get("event_title") or "").strip(),
                    "description": str(item.get("description") or "").strip(),
                    "category": str(item.get("category") or item.get("event_category") or "").strip(),
                    "location": str(item.get("location") or item.get("event_location") or "").strip(),
                    "location_type": str(item.get("location_type") or "").strip(),
                    "event_date": str(item.get("event_date") or "").strip(),
                    "event_time": str(item.get("event_time") or "").strip(),
                    "status": str(item.get("status") or item.get("event_status") or "").strip(),
                    "payment_status": str(item.get("payment_status") or "").strip(),
                    "is_paid": bool(item.get("is_paid")) if "is_paid" in item else None,
                    "price": item.get("price")
                    if isinstance(item.get("price"), (int, float))
                    else item.get("payment_amount"),
                }
            )
    return candidates


def message_tokens(message: str) -> list[str]:
    return [
        token
        for token in normalize_text(message).split()
        if token not in GENERIC_EVENT_TOKENS and token not in ORDINAL_WORDS
    ]


def candidate_haystack(candidate: dict[str, object]) -> str:
    return " ".join(
        normalize_text(str(candidate.get(field) or ""))
        for field in ("title", "description", "category", "location", "location_type")
    )


def filter_candidates_by_message(candidates: list[dict[str, object]], message: str) -> list[dict[str, object]]:
    if not candidates:
        return []

    normalized = normalize_text(message)
    filtered = list(candidates)

    if any(phrase in normalized for phrase in ("free", "no cost", "without payment")) and "paid" not in normalized:
        free_matches = [candidate for candidate in filtered if candidate.get("is_paid") is False]
        if free_matches:
            filtered = free_matches

    if any(phrase in normalized for phrase in ("paid", "ticketed", "payment")) and "free" not in normalized:
        paid_matches = [candidate for candidate in filtered if candidate.get("is_paid") is True]
        if paid_matches:
            filtered = paid_matches

    if "weekend" in normalized:
        weekend_matches = [candidate for candidate in filtered if is_weekend(str(candidate.get("event_date") or ""))]
        if weekend_matches:
            filtered = weekend_matches

    if any(phrase in normalized for phrase in ("cheaper one", "cheapest", "lower price", "less expensive")):
        priced = [candidate for candidate in filtered if isinstance(candidate.get("price"), (int, float))]
        if priced:
            return [sorted(priced, key=lambda candidate: float(candidate.get("price") or 0))[0]]

    if "after this" in normalized and len(filtered) >= 2:
        return [filtered[1]]

    tokens = message_tokens(message)
    if tokens:
        token_matches = [
            candidate
            for candidate in filtered
            if all(token in candidate_haystack(candidate) for token in tokens)
        ]
        if token_matches:
            filtered = token_matches

    ordinal_index = extract_ordinal_index(message)
    if ordinal_index is not None and 0 <= ordinal_index < len(filtered):
        return [filtered[ordinal_index]]

    return filtered


def resolve_event_target(
    payload: ChatRequest,
    event_id: str | None,
    event_title: str | None,
) -> tuple[str | None, str | None]:
    normalized_id = str(event_id or "").strip() or None
    normalized_title = str(event_title or "").strip() or None
    if normalized_id:
        return normalized_id, normalized_title

    candidates = extract_recent_event_candidates(payload)
    if not candidates:
        return None, normalized_title

    message_text = str(payload.message or "")
    filtered = filter_candidates_by_message(candidates, message_text)
    if len(filtered) == 1:
        selected = filtered[0]
        return str(selected.get("event_id") or ""), str(selected.get("title") or "").strip() or normalized_title

    if normalized_title:
        lowered_title = normalized_title.lower()
        exact_match = next(
            (
                candidate
                for candidate in candidates
                if str(candidate.get("title") or "").strip().lower() == lowered_title
            ),
            None,
        )
        if exact_match:
            return str(exact_match.get("event_id") or ""), str(exact_match.get("title") or "")

        partial_match = next(
            (
                candidate
                for candidate in candidates
                if lowered_title in str(candidate.get("title") or "").strip().lower()
            ),
            None,
        )
        if partial_match:
            return str(partial_match.get("event_id") or ""), str(partial_match.get("title") or "")

    if len(candidates) == 1:
        selected = candidates[0]
        return str(selected.get("event_id") or ""), str(selected.get("title") or "").strip() or normalized_title

    return None, normalized_title
