from __future__ import annotations

from typing import Any

from app.core.exceptions import ToolExecutionError
from app.models.chat import ChatRequest
from app.tools.action_tools.courses.shared import CourseActionTool


class PlayCurrentLessonTool(CourseActionTool):
    name = "play_current_lesson"
    description = (
        "Find the current lesson for an enrolled ParamSukh course and prepare the in-app playback step."
    )
    parameters = {
        "type": "object",
        "properties": {
            "course_id": {
                "type": "string",
                "description": "Optional enrolled course id from a recent course tool result.",
            },
            "course_title": {
                "type": "string",
                "description": "Optional course title when the user names a specific enrolled course.",
            },
        },
        "additionalProperties": False,
    }

    async def execute(self, arguments: dict[str, object], payload: ChatRequest) -> dict[str, object]:
        auth_token = self.require_auth_token(payload)
        requested_course_id = str(arguments.get("course_id", "")).strip() or None
        requested_course_title = str(arguments.get("course_title", "")).strip() or None

        resolved_course_id, enrolled_course, enrolled_items = await self.resolve_enrolled_course_target(
            payload,
            course_id=requested_course_id,
            course_title=requested_course_title,
            auth_token=auth_token,
            prefer_continue_learning=True,
        )

        if not enrolled_items:
            return {
                "success": True,
                "summary": "The user is not enrolled in any courses yet.",
                "data": {
                    "action": "no_enrollments",
                    "status": "not_enrolled",
                    "message": "You are not enrolled in any course yet. Ask me to show the available courses and I can help you choose one.",
                },
            }

        if not resolved_course_id or not enrolled_course:
            named_course = requested_course_title or requested_course_id or ("that course" if resolved_course_id else None)
            if named_course:
                return {
                    "success": True,
                    "summary": "The requested course is not currently enrolled for this user.",
                    "data": {
                        "action": "not_enrolled_in_course",
                        "status": "not_enrolled",
                        "course_id": resolved_course_id,
                        "message": f"You are not enrolled in {named_course}, so I cannot open its lesson yet. If you want, I can help you enroll first.",
                    },
                }

            return {
                "success": True,
                "summary": "A specific enrolled course is needed before lesson playback can continue.",
                "data": {
                    "action": "course_selection_required",
                    "status": "selection_required",
                    "message": "I could not tell which enrolled course you want to continue. Ask me to show your enrolled courses and then tell me which one to open.",
                    "enrolled_count": len(enrolled_items),
                },
            }

        try:
            detail = await self.backend_client.get_enrolled_course_detail(auth_token, resolved_course_id)
        except ToolExecutionError as exc:
            return self._normalize_playback_issue(
                message=str(exc),
                course_id=resolved_course_id,
                course=enrolled_course,
            )

        course = self.format_course_payload(detail.get("course"), resolved_course_id)
        progress = detail.get("progress") if isinstance(detail.get("progress"), dict) else {}
        lesson = detail.get("current_video") if isinstance(detail.get("current_video"), dict) else None
        has_videos = bool(detail.get("videos"))

        if not has_videos:
            return {
                "success": True,
                "summary": "This enrolled course does not have a playable lesson right now.",
                "data": {
                    "action": "lesson_unavailable",
                    "status": "unavailable",
                    "course_id": resolved_course_id,
                    "course": course,
                    "message": "This course does not have any playable video lessons right now.",
                },
            }

        if not lesson:
            is_completed = bool(progress.get("is_completed"))
            return {
                "success": True,
                "summary": (
                    "The course is already completed."
                    if is_completed
                    else "I could not determine the next lesson right now."
                ),
                "data": {
                    "action": "course_completed" if is_completed else "lesson_unavailable",
                    "status": "completed" if is_completed else "unavailable",
                    "course_id": resolved_course_id,
                    "course": course,
                    "progress": progress,
                    "message": (
                        "You have already completed this course. If you want, I can help you revisit the course details or suggest what to learn next."
                        if is_completed
                        else "I could not determine the lesson to resume right now. Please open the course details once and try again."
                    ),
                    "destination": self._build_course_destination(course, None),
                },
            }

        destination = self._build_course_destination(course, lesson)
        can_direct_play = destination.get("route") == "/video-player"
        course_title = str(course.get("title") or "your course").strip()
        lesson_title = str(lesson.get("title") or "your current lesson").strip()
        progress_pct = progress.get("percentage")

        return {
            "success": True,
            "summary": (
                f"{lesson_title} is ready to continue in {course_title}."
                if can_direct_play
                else f"I found the next lesson inside {course_title}."
            ),
            "data": {
                "action": "lesson_ready" if can_direct_play else "lesson_in_course",
                "status": "ready",
                "course_id": resolved_course_id,
                "course": course,
                "progress": progress,
                "lesson": lesson,
                "can_direct_play": can_direct_play,
                "destination": destination,
                "message": (
                    f"I found your current lesson in {course_title}. Tap below and I will open it for you."
                    if can_direct_play
                    else f"I found your current lesson in {course_title}. Tap below and I will open the course so you can continue from there."
                ),
                "follow_up": (
                    "After you watch it, I can also show your course progress or suggest which course to finish next."
                    if isinstance(progress_pct, (int, float))
                    else "After that, I can also help with your course progress or enrolled courses."
                ),
            },
        }

    def _normalize_playback_issue(
        self,
        *,
        message: str,
        course_id: str,
        course: dict[str, Any] | None,
    ) -> dict[str, object]:
        lowered = (message or "").strip().lower()
        course_payload = self.format_course_payload(course, course_id)

        if "enroll" in lowered and "first" in lowered:
            return {
                "success": True,
                "summary": "The user is not enrolled in the requested course.",
                "data": {
                    "action": "not_enrolled_in_course",
                    "status": "not_enrolled",
                    "course_id": course_id,
                    "course": course_payload,
                    "message": "You need to be enrolled in this course before I can open its current lesson.",
                },
            }

        if "not found" in lowered:
            return {
                "success": True,
                "summary": "The requested course could not be loaded.",
                "data": {
                    "action": "course_unavailable",
                    "status": "unavailable",
                    "course_id": course_id,
                    "course": course_payload,
                    "message": "I could not load that enrolled course right now. Please try again shortly.",
                },
            }

        return {
            "success": True,
            "summary": "The current lesson could not be opened right now.",
            "data": {
                "action": "lesson_playback_unavailable",
                "status": "failed",
                "course_id": course_id,
                "course": course_payload,
                "message": "I could not prepare your current lesson right now. Please try again in a moment.",
            },
        }

    @staticmethod
    def _build_course_destination(course: dict[str, Any], lesson: dict[str, Any] | None) -> dict[str, Any]:
        course_id = str(course.get("id") or course.get("course_id") or "").strip()
        course_title = str(course.get("title") or "Course").strip()
        course_color = str(course.get("color") or "#D97706").strip() or "#D97706"

        if not lesson or not lesson.get("video_url"):
            return {
                "route": "/course-detail",
                "params": {
                    "id": course_id,
                    "title": course_title,
                    "color": course_color,
                    "duration": str(course.get("duration") or "").strip(),
                },
            }

        return {
            "route": "/video-player",
            "params": {
                "courseId": course_id,
                "courseTitle": course_title,
                "courseColor": course_color,
                "videoId": str(lesson.get("id") or "").strip(),
                "videoTitle": str(lesson.get("title") or "Current lesson").strip(),
                "videoDuration": str(lesson.get("duration") or "").strip(),
                "videoUrl": str(lesson.get("video_url") or "").strip(),
            },
        }
