from typing import Any

from app.models.chat import ChatRequest
from app.services.backend_client import BackendClient
from app.tools.common import AppTool
from app.tools.information_tools.courses.shared import (
    filter_course_candidates_by_message,
    normalize_course_text,
    resolve_course_target,
)


class CourseActionTool(AppTool):
    def __init__(self) -> None:
        self.backend_client = BackendClient()

    @staticmethod
    def format_course_payload(course: dict[str, object] | None, course_id: str) -> dict[str, object]:
        course = course if isinstance(course, dict) else {}
        return {
            "id": course.get("id") or course.get("course_id") or course_id,
            "title": course.get("title") or course.get("course_title") or "Selected course",
            "category": course.get("category") or course.get("course_category"),
            "duration": course.get("duration") or course.get("course_duration"),
            "total_videos": course.get("total_videos"),
            "total_pdfs": course.get("total_pdfs"),
            "thumbnail_url": course.get("thumbnail_url"),
            "color": course.get("color") or course.get("course_color"),
            "access": course.get("access") or {},
            "progress": course.get("progress"),
            "current_video_index": course.get("current_video_index"),
            "last_accessed_at": course.get("last_accessed_at"),
        }

    async def resolve_course_action_target(
        self,
        payload: ChatRequest,
        *,
        course_id: str | None,
        course_title: str | None,
        auth_token: str,
    ) -> tuple[str | None, dict[str, object] | None]:
        resolved_course_id, resolved_course_title = resolve_course_target(payload, course_id, course_title)
        catalog = await self.backend_client.get_enrollment_catalog(auth_token)
        items = [item for item in catalog.get("items", []) if isinstance(item, dict)]

        if resolved_course_id:
            exact_id_match = next(
                (item for item in items if str(item.get("id") or "").strip() == resolved_course_id),
                None,
            )
            if exact_id_match:
                return resolved_course_id, exact_id_match

        normalized_title = normalize_course_text(resolved_course_title or course_title)
        if normalized_title:
            exact_title_match = next(
                (
                    item
                    for item in items
                    if normalize_course_text(str(item.get("title") or "")) == normalized_title
                ),
                None,
            )
            if exact_title_match:
                return str(exact_title_match.get("id") or "").strip() or None, exact_title_match

            partial_match = next(
                (
                    item
                    for item in items
                    if normalized_title in normalize_course_text(str(item.get("title") or ""))
                ),
                None,
            )
            if partial_match:
                return str(partial_match.get("id") or "").strip() or None, partial_match

        return resolved_course_id, None

    async def resolve_enrolled_course_target(
        self,
        payload: ChatRequest,
        *,
        course_id: str | None,
        course_title: str | None,
        auth_token: str,
        prefer_continue_learning: bool = False,
    ) -> tuple[str | None, dict[str, Any] | None, list[dict[str, Any]]]:
        resolved_course_id, resolved_course_title = resolve_course_target(payload, course_id, course_title)
        enrollments = await self.backend_client.get_my_enrollments(auth_token, limit=50)
        items = [item for item in enrollments.get("items", []) if isinstance(item, dict)]

        if resolved_course_id:
            exact_id_match = next(
                (
                    item
                    for item in items
                    if str(item.get("course_id") or item.get("id") or "").strip() == resolved_course_id
                ),
                None,
            )
            if exact_id_match:
                return resolved_course_id, exact_id_match, items

        normalized_title = normalize_course_text(resolved_course_title or course_title)
        if normalized_title:
            exact_title_match = next(
                (
                    item
                    for item in items
                    if normalize_course_text(
                        str(item.get("course_title") or item.get("title") or "")
                    )
                    == normalized_title
                ),
                None,
            )
            if exact_title_match:
                return (
                    str(exact_title_match.get("course_id") or exact_title_match.get("id") or "").strip() or None,
                    exact_title_match,
                    items,
                )

            partial_title_match = next(
                (
                    item
                    for item in items
                    if normalized_title
                    in normalize_course_text(str(item.get("course_title") or item.get("title") or ""))
                ),
                None,
            )
            if partial_title_match:
                return (
                    str(partial_title_match.get("course_id") or partial_title_match.get("id") or "").strip() or None,
                    partial_title_match,
                    items,
                )

        filtered_items = filter_course_candidates_by_message(items, str(payload.message or ""))
        if len(filtered_items) == 1:
            matched = filtered_items[0]
            return str(matched.get("course_id") or matched.get("id") or "").strip() or None, matched, items

        if prefer_continue_learning:
            continue_learning = await self.backend_client.get_continue_learning(auth_token, limit=10)
            continue_items = [item for item in continue_learning.get("items", []) if isinstance(item, dict)]
            continue_ids = {
                str(item.get("course_id") or item.get("id") or "").strip()
                for item in continue_items
                if str(item.get("course_id") or item.get("id") or "").strip()
            }

            prioritized_match = next(
                (
                    item
                    for item in filtered_items
                    if str(item.get("course_id") or item.get("id") or "").strip() in continue_ids
                ),
                None,
            )
            if prioritized_match:
                return (
                    str(prioritized_match.get("course_id") or prioritized_match.get("id") or "").strip() or None,
                    prioritized_match,
                    items,
                )

            if not resolved_course_id and len(continue_items) == 1:
                chosen = continue_items[0]
                chosen_id = str(chosen.get("course_id") or chosen.get("id") or "").strip()
                enrollment_match = next(
                    (
                        item
                        for item in items
                        if str(item.get("course_id") or item.get("id") or "").strip() == chosen_id
                    ),
                    chosen,
                )
                return chosen_id or None, enrollment_match, items

            if not resolved_course_id and continue_items:
                chosen = continue_items[0]
                chosen_id = str(chosen.get("course_id") or chosen.get("id") or "").strip()
                enrollment_match = next(
                    (
                        item
                        for item in items
                        if str(item.get("course_id") or item.get("id") or "").strip() == chosen_id
                    ),
                    chosen,
                )
                return chosen_id or None, enrollment_match, items

        return resolved_course_id, None, items
