from app.models.chat import ChatRequest
from app.services.backend_client import BackendClient
from app.tools.common import AppTool

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

GENERIC_COURSE_TOKENS = {
    "show",
    "me",
    "course",
    "courses",
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
    "my",
    "what",
    "which",
    "about",
    "tell",
    "progress",
    "details",
    "continue",
    "learning",
    "enrolled",
    "doing",
    "am",
    "i",
    "is",
    "are",
    "get",
}


class CourseInformationTool(AppTool):
    def __init__(self) -> None:
        self.backend_client = BackendClient()


def normalize_course_catalog_query(raw_query: str) -> str:
    query = " ".join(raw_query.lower().strip().split())
    if not query:
        return ""

    generic_queries = {
        "course",
        "courses",
        "show course",
        "show courses",
        "show me course",
        "show me courses",
        "available course",
        "available courses",
        "what course",
        "what courses",
        "what courses are available",
        "list course",
        "list courses",
        "list all course",
        "list all courses",
        "all course",
        "all courses",
        "browse course",
        "browse courses",
        "course catalog",
        "courses catalog",
    }
    return "" if query in generic_queries else raw_query.strip()


def normalize_course_text(value: str | None) -> str:
    return " ".join(
        str(value or "")
        .lower()
        .replace("?", " ")
        .replace(",", " ")
        .replace("-", " ")
        .split()
    )


def matches_course_query(course: dict[str, object], query: str) -> bool:
    query_lower = query.lower()
    searchable_fields = (
        str(course.get("title") or ""),
        str(course.get("description") or ""),
        str(course.get("category") or ""),
        " ".join(str(tag) for tag in (course.get("tags") or [])),
    )
    return any(query_lower in field.lower() for field in searchable_fields)


def extract_recent_course_candidates(payload: ChatRequest) -> list[dict[str, object]]:
    conversation = payload.conversation
    if not conversation:
        return []

    candidates: list[dict[str, object]] = []
    seen_ids: set[str] = set()

    for message in reversed(conversation.recent_messages):
        if message.role != "tool":
            continue
        if message.toolName not in {
            "search_courses",
            "recommend_courses",
            "get_my_enrollments",
            "get_continue_learning",
            "get_course_progress",
            "compare_courses",
            "enroll_in_course",
            "play_current_lesson",
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
        if isinstance(data.get("course"), dict):
            items.append(data["course"])

        for item in items:
            course_id = str(item.get("id") or item.get("course_id") or "").strip()
            if not course_id or course_id in seen_ids:
                continue
            seen_ids.add(course_id)
            candidates.append(
                {
                    "course_id": course_id,
                    "title": str(item.get("title") or item.get("course_title") or "").strip(),
                    "description": str(item.get("description") or item.get("course_description") or "").strip(),
                    "category": str(item.get("category") or item.get("course_category") or "").strip(),
                    "duration": str(item.get("duration") or item.get("course_duration") or "").strip(),
                    "status": str(item.get("status") or "").strip(),
                    "progress": item.get("progress"),
                    "is_completed": bool(item.get("is_completed")) if "is_completed" in item else None,
                    "last_accessed_at": str(item.get("last_accessed_at") or "").strip(),
                }
            )
    return candidates


def extract_ordinal_index(text: str | None) -> int | None:
    for token in normalize_course_text(text).split():
        if token in ORDINAL_WORDS:
            return ORDINAL_WORDS[token]
    return None


def course_message_tokens(message: str) -> list[str]:
    return [
        token
        for token in normalize_course_text(message).split()
        if token not in GENERIC_COURSE_TOKENS and token not in ORDINAL_WORDS
    ]


def course_candidate_haystack(candidate: dict[str, object]) -> str:
    return " ".join(
        normalize_course_text(str(candidate.get(field) or ""))
        for field in ("title", "description", "category", "duration", "status")
    )


def _progress_value(candidate: dict[str, object]) -> float:
    progress = candidate.get("progress")
    if isinstance(progress, (int, float)):
        return float(progress)
    if isinstance(progress, str):
        try:
            return float(progress)
        except ValueError:
            return 0.0
    return 0.0


def filter_course_candidates_by_message(candidates: list[dict[str, object]], message: str) -> list[dict[str, object]]:
    if not candidates:
        return []

    normalized = normalize_course_text(message)
    filtered = list(candidates)

    if any(phrase in normalized for phrase in ("completed", "finished", "done", "completed courses")):
        completed_matches = [candidate for candidate in filtered if candidate.get("is_completed") is True]
        if completed_matches:
            filtered = completed_matches

    if any(
        phrase in normalized
        for phrase in ("in progress", "continuing", "currently learning", "doing", "active course", "continue next")
    ):
        in_progress_matches = [
            candidate
            for candidate in filtered
            if candidate.get("is_completed") is not True and _progress_value(candidate) > 0
        ]
        if in_progress_matches:
            filtered = in_progress_matches

    if any(phrase in normalized for phrase in ("not started", "haven't started", "yet to start")):
        not_started_matches = [
            candidate
            for candidate in filtered
            if candidate.get("is_completed") is not True and _progress_value(candidate) <= 0
        ]
        if not_started_matches:
            filtered = not_started_matches

    tokens = course_message_tokens(message)
    if tokens:
        token_matches = [
            candidate
            for candidate in filtered
            if all(token in course_candidate_haystack(candidate) for token in tokens)
        ]
        if token_matches:
            filtered = token_matches

    ordinal_index = extract_ordinal_index(message)
    if ordinal_index is not None and 0 <= ordinal_index < len(filtered):
        return [filtered[ordinal_index]]

    return filtered


def resolve_course_target(
    payload: ChatRequest,
    course_id: str | None,
    course_title: str | None,
) -> tuple[str | None, str | None]:
    normalized_id = str(course_id or "").strip() or None
    normalized_title = str(course_title or "").strip() or None
    if normalized_id:
        return normalized_id, normalized_title

    candidates = extract_recent_course_candidates(payload)
    if not candidates:
        return None, normalized_title

    filtered = filter_course_candidates_by_message(candidates, str(payload.message or ""))
    if len(filtered) == 1:
        selected = filtered[0]
        return str(selected.get("course_id") or ""), str(selected.get("title") or "").strip() or normalized_title

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
            return str(exact_match.get("course_id") or ""), str(exact_match.get("title") or "")

        partial_match = next(
            (
                candidate
                for candidate in candidates
                if lowered_title in str(candidate.get("title") or "").strip().lower()
            ),
            None,
        )
        if partial_match:
            return str(partial_match.get("course_id") or ""), str(partial_match.get("title") or "")

    return None, normalized_title


def extract_course_focus(text: str | None) -> str | None:
    normalized = normalize_course_text(text)
    if not normalized:
        return None
    if any(
        phrase in normalized
        for phrase in (
            "closest to completion",
            "almost complete",
            "nearest to completion",
            "closest completion",
        )
    ):
        return "closest_completion"
    if any(
        phrase in normalized
        for phrase in (
            "finish first",
            "complete first",
            "should i finish",
            "what should i finish",
            "what should i complete next",
        )
    ):
        return "finish_first"
    if any(phrase in normalized for phrase in ("better for beginners", "best for beginners", "beginner")):
        return "beginners"
    if any(phrase in normalized for phrase in ("shorter", "shortest", "less time", "quicker")):
        return "shorter"
    if any(phrase in normalized for phrase in ("deeper", "more depth", "more detailed", "advanced")):
        return "depth"
    return "general_comparison" if "compare" in normalized or "better" in normalized else None


def format_course_focus_label(focus: str | None) -> str:
    labels = {
        "closest_completion": "Closest To Completion",
        "finish_first": "Best Course To Finish First",
        "beginners": "Beginner Fit",
        "shorter": "Shorter Commitment",
        "depth": "Learning Depth",
        "general_comparison": "General Comparison",
    }
    return labels.get(str(focus or "").strip(), "Course Comparison")


def _extract_duration_weight(value: str | None) -> int:
    normalized = normalize_course_text(value)
    if not normalized:
        return 0

    total = 0
    tokens = normalized.split()
    for index, token in enumerate(tokens):
        if not token.isdigit():
            continue
        amount = int(token)
        next_token = tokens[index + 1] if index + 1 < len(tokens) else ""
        if next_token.startswith("week"):
            total += amount * 7
        elif next_token.startswith("day"):
            total += amount
        elif next_token.startswith("month"):
            total += amount * 30
        elif next_token.startswith("hour"):
            total += max(1, amount // 2)
    return total


def _text_contains_any(text: str, phrases: tuple[str, ...]) -> bool:
    return any(phrase in text for phrase in phrases)


def score_course_for_focus(item: dict[str, object], focus: str | None) -> tuple[int, int, int, int]:
    normalized_focus = str(focus or "").strip()
    title = normalize_course_text(str(item.get("title") or item.get("course_title") or ""))
    description = normalize_course_text(str(item.get("description") or item.get("course_description") or ""))
    category = normalize_course_text(str(item.get("category") or item.get("course_category") or ""))
    status = normalize_course_text(str(item.get("status") or ""))
    text = " ".join(part for part in (title, description, category, status) if part)
    progress = int(round(_progress_value(item)))
    duration_weight = _extract_duration_weight(str(item.get("duration") or item.get("course_duration") or ""))
    total_videos = int(item.get("total_videos") or 0) if isinstance(item.get("total_videos"), (int, float)) else 0
    total_pdfs = int(item.get("total_pdfs") or 0) if isinstance(item.get("total_pdfs"), (int, float)) else 0
    content_depth = total_videos + total_pdfs
    is_completed = item.get("is_completed") is True
    is_active = progress > 0 and not is_completed

    if normalized_focus == "closest_completion":
        return (
            0 if is_completed else 1,
            progress,
            1 if is_active else 0,
            -duration_weight,
        )

    if normalized_focus == "finish_first":
        return (
            0 if is_completed else 1,
            progress,
            -duration_weight,
            content_depth,
        )

    if normalized_focus == "beginners":
        beginner_score = 0
        if _text_contains_any(text, ("beginner", "beginners", "basic", "foundation", "intro", "introduction")):
            beginner_score += 5
        if _text_contains_any(text, ("advanced", "intensive", "deep dive")):
            beginner_score -= 4
        return beginner_score, -duration_weight, progress, content_depth

    if normalized_focus == "shorter":
        return -duration_weight, progress, -content_depth, 1 if is_active else 0

    if normalized_focus == "depth":
        return content_depth, duration_weight, progress, 1 if is_active else 0

    return progress, 1 if is_active else 0, content_depth, -duration_weight


def resolve_course_pair(
    payload: ChatRequest,
    first_course_id: str | None,
    second_course_id: str | None,
    first_course_title: str | None,
    second_course_title: str | None,
    message_text: str,
) -> tuple[list[dict[str, object]], str | None]:
    recent_items = extract_recent_course_candidates(payload)
    if not recent_items:
        return [], None

    resolved: list[dict[str, object]] = []
    requested_ids = [str(first_course_id or "").strip(), str(second_course_id or "").strip()]
    requested_titles = [str(first_course_title or "").strip(), str(second_course_title or "").strip()]

    for requested_id in requested_ids:
        normalized_id = requested_id.strip()
        if not normalized_id:
            continue
        for item in recent_items:
            if str(item.get("course_id") or item.get("id") or "").strip() == normalized_id:
                if item not in resolved:
                    resolved.append(item)
                break

    for requested_title in requested_titles:
        normalized_title = requested_title.strip().lower()
        if not normalized_title:
            continue
        for item in recent_items:
            title = str(item.get("title") or item.get("course_title") or "").strip()
            if title and normalized_title in title.lower():
                if item not in resolved:
                    resolved.append(item)
                break

    ordinal_indices: list[int] = []
    for token in normalize_course_text(message_text).split():
        if token in ORDINAL_WORDS:
            index = ORDINAL_WORDS[token]
            if index not in ordinal_indices:
                ordinal_indices.append(index)

    for index in ordinal_indices:
        if 0 <= index < len(recent_items):
            item = recent_items[index]
            if item not in resolved:
                resolved.append(item)

    if len(resolved) >= 2:
        return resolved[:2], "Compared the two courses referenced from recent context."

    normalized_message = normalize_course_text(message_text)
    if any(
        phrase in normalized_message
        for phrase in ("compare these two", "compare both", "these two courses", "both courses")
    ) and len(recent_items) >= 2:
        return recent_items[:2], "Compared the first two courses from the recent list."

    return resolved[:2], None


def clamp_limit(raw_limit: object, *, default: int, minimum: int, maximum: int) -> int:
    limit = int(raw_limit) if isinstance(raw_limit, (int, float, str)) else default
    return max(minimum, min(limit, maximum))
