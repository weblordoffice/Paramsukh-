from __future__ import annotations

from app.models.chat import ChatRequest
from app.tools.information_tools.courses.shared import (
    CourseInformationTool,
    extract_course_focus,
    format_course_focus_label,
    _progress_value,
    extract_recent_course_candidates,
    resolve_course_pair,
    score_course_for_focus,
)


class CompareCoursesTool(CourseInformationTool):
    name = "compare_courses"
    description = (
        "Compare ParamSukh courses and decide which enrolled or recently viewed course is better to finish first, "
        "closer to completion, shorter, deeper, or more beginner friendly."
    )
    parameters = {
        "type": "object",
        "properties": {
            "first_course_id": {"type": "string", "description": "Optional id of the first course."},
            "second_course_id": {"type": "string", "description": "Optional id of the second course."},
            "first_course_title": {"type": "string", "description": "Optional title of the first course."},
            "second_course_title": {"type": "string", "description": "Optional title of the second course."},
            "comparison_focus": {
                "type": "string",
                "description": (
                    "Optional focus such as closest_completion, finish_first, beginners, shorter, depth, "
                    "or general_comparison."
                ),
            },
        },
        "required": [],
        "additionalProperties": False,
    }

    @staticmethod
    def _build_reason(focus: str, recommended: dict[str, object]) -> str:
        progress = int(round(_progress_value(recommended)))
        reasons: list[str] = []

        if focus == "closest_completion" and progress > 0:
            reasons.append(f"{progress}% progress already completed")
        elif focus == "finish_first":
            if progress > 0:
                reasons.append(f"already {progress}% complete")
            if recommended.get("last_accessed_at"):
                reasons.append("recently active")
        elif focus == "beginners":
            reasons.append("more beginner friendly")
        elif focus == "shorter":
            duration = str(recommended.get("duration") or "").strip()
            if duration:
                reasons.append(f"shorter time commitment ({duration})")
        elif focus == "depth":
            total_videos = int(recommended.get("total_videos") or 0) if isinstance(recommended.get("total_videos"), (int, float)) else 0
            total_pdfs = int(recommended.get("total_pdfs") or 0) if isinstance(recommended.get("total_pdfs"), (int, float)) else 0
            if total_videos or total_pdfs:
                reasons.append(f"richer learning content ({total_videos} videos, {total_pdfs} PDFs)")

        if recommended.get("is_completed") is True:
            reasons.append("already completed")

        return ", ".join(reasons) or "overall fit"

    @staticmethod
    def _normalize_comparison_items(items: list[dict[str, object]]) -> list[dict[str, object]]:
        normalized: list[dict[str, object]] = []
        for item in items:
            normalized.append(
                {
                    "id": item.get("course_id") or item.get("id"),
                    "title": item.get("course_title") or item.get("title"),
                    "description": item.get("course_description") or item.get("description"),
                    "category": item.get("course_category") or item.get("category"),
                    "duration": item.get("course_duration") or item.get("duration"),
                    "status": item.get("status"),
                    "progress": item.get("progress"),
                    "is_completed": item.get("is_completed"),
                    "last_accessed_at": item.get("last_accessed_at"),
                    "total_videos": item.get("total_videos"),
                    "total_pdfs": item.get("total_pdfs"),
                    "color": item.get("course_color") or item.get("color"),
                    "thumbnail_url": item.get("thumbnail_url"),
                }
            )
        return normalized

    async def execute(self, arguments: dict[str, object], payload: ChatRequest) -> dict[str, object]:
        message_text = str(payload.message or "").strip()
        focus = str(arguments.get("comparison_focus", "")).strip() or extract_course_focus(message_text) or "finish_first"

        pair_items, note = resolve_course_pair(
            payload,
            str(arguments.get("first_course_id", "")).strip() or None,
            str(arguments.get("second_course_id", "")).strip() or None,
            str(arguments.get("first_course_title", "")).strip() or None,
            str(arguments.get("second_course_title", "")).strip() or None,
            message_text,
        )

        auth_token = payload.backend_auth_token
        ranked_items: list[dict[str, object]] = []

        if auth_token:
            enrollments = await self.backend_client.get_my_enrollments(auth_token, limit=None)
            enrolled_items = self._normalize_comparison_items(
                [item for item in enrollments.get("items", []) if isinstance(item, dict)]
            )

            if pair_items:
                pair_ids = {
                    str(item.get("course_id") or item.get("id") or "").strip()
                    for item in pair_items
                    if str(item.get("course_id") or item.get("id") or "").strip()
                }
                ranked_items = [item for item in enrolled_items if str(item.get("id") or "").strip() in pair_ids]
                if len(ranked_items) < 2:
                    ranked_items = self._normalize_comparison_items(pair_items)
            elif enrolled_items:
                candidate_items = [item for item in enrolled_items if item.get("is_completed") is not True]
                ranked_items = candidate_items or enrolled_items

        if not ranked_items and pair_items:
            ranked_items = self._normalize_comparison_items(pair_items)
        elif not ranked_items:
            recent_items = extract_recent_course_candidates(payload)
            if recent_items:
                ranked_items = self._normalize_comparison_items(recent_items)

        if not ranked_items:
            raise self.tool_error(
                "I need at least two relevant courses to compare. Please mention two course names, ask me to show your enrolled courses first, or open a course list before comparing."
            )

        ranked_items = sorted(ranked_items, key=lambda item: score_course_for_focus(item, focus), reverse=True)
        shortlisted = ranked_items[:2]
        recommended = shortlisted[0]
        reason = self._build_reason(focus, recommended)

        comparison_rows = [
            {"label": "Focus", "value": format_course_focus_label(focus)},
            {"label": "Best Match", "value": str(recommended.get("title") or "Recommended course")},
            {"label": "Why", "value": reason},
        ]
        alternative = shortlisted[1] if len(shortlisted) > 1 else None
        if alternative:
            comparison_rows.insert(2, {"label": "Alternative", "value": str(alternative.get("title") or "Alternative course")})

        if alternative and focus in {"closest_completion", "finish_first"}:
            comparison_rows.append(
                {
                    "label": "Progress",
                    "value": (
                        f"{int(round(_progress_value(recommended)))}% vs "
                        f"{int(round(_progress_value(alternative)))}%"
                    ),
                }
            )

        return {
            "success": True,
            "summary": (
                f"{note + ' ' if note else ''}"
                f"For {format_course_focus_label(focus)}, '{recommended.get('title')}'"
                + (
                    f" looks stronger than '{alternative.get('title')}'."
                    if alternative
                    else " is the strongest match from your current course context."
                )
            ),
            "data": {
                "focus": focus,
                "comparison_mode": "course",
                "rows": comparison_rows,
                "recommended_course_id": recommended.get("id"),
                "recommended_course_title": recommended.get("title"),
                "items": shortlisted,
            },
        }
