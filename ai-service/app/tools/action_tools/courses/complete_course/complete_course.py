from app.core.exceptions import ToolExecutionError
from app.models.chat import ChatRequest
from app.tools.action_tools.courses.shared import CourseActionTool


class CompleteCourseTool(CourseActionTool):
    name = "complete_course"
    description = (
        "Mark a course that the user is enrolled in as completed after the user explicitly confirms they want to mark it complete."
    )
    parameters = {
        "type": "object",
        "properties": {
            "course_id": {
                "type": "string",
                "description": "The course id from recent course details or enrollment search results.",
            },
            "course_title": {
                "type": "string",
                "description": "Optional course title when the user names a course directly or refers to a recent course results.",
            },
            "user_confirmed": {
                "type": "boolean",
                "description": "True only when the user clearly confirmed they want to mark this course as completed.",
            },
        },
        "required": ["user_confirmed"],
        "additionalProperties": False,
    }

    async def execute(self, arguments: dict[str, object], payload: ChatRequest) -> dict[str, object]:
        auth_token = self.require_auth_token(payload)
        requested_course_id = str(arguments.get("course_id", "")).strip() or None
        requested_course_title = str(arguments.get("course_title", "")).strip() or None
        user_confirmed = bool(arguments.get("user_confirmed", False))

        # Resolve targets from user's current enrollments
        resolved_course_id, enrollment, all_enrollments = await self.resolve_enrolled_course_target(
            payload,
            course_id=requested_course_id,
            course_title=requested_course_title,
            auth_token=auth_token,
        )

        if not resolved_course_id:
            raise self.tool_error(
                "I could not find which active enrollment you want to complete. Please state the course name or check your active courses first."
            )

        course_title = str(
            (enrollment or {}).get("course_title")
            or requested_course_title
            or resolved_course_id
        ).strip()

        course_payload = self.format_course_payload(enrollment, resolved_course_id)

        # Pre-check if already completed
        if enrollment and enrollment.get("is_completed") is True:
            return {
                "success": True,
                "summary": f"You have already completed {course_title}.",
                "data": {
                    "action": "already_completed",
                    "course_id": resolved_course_id,
                    "course": course_payload,
                    "status": "already_completed",
                    "message": f"You have already marked {course_title} as completed.",
                },
            }

        # Ask for confirmation if not confirmed
        if not user_confirmed:
            return {
                "success": True,
                "summary": f"Ready to mark {course_title} as completed.",
                "data": {
                    "action": "confirmation_required",
                    "course_id": resolved_course_id,
                    "course": course_payload,
                    "status": "confirmation_required",
                    "message": f"Are you sure you want to mark {course_title} as completed? Please confirm to proceed.",
                },
            }

        try:
            # Perform completion call
            result = await self.backend_client.complete_course(auth_token, resolved_course_id)
            verification = await self.backend_client.get_course_enrollment_status(auth_token, resolved_course_id)
            verified_completed = bool(verification.get("is_completed"))

            return {
                "success": True,
                "summary": (
                    f"Successfully marked {course_title} as completed!"
                    if verified_completed
                    else "The completion request went through, but I could not verify the completed state yet."
                ),
                "data": {
                    "action": "course_completed" if verified_completed else "completion_pending_verification",
                    "course_id": resolved_course_id,
                    "course": course_payload,
                    "status": "completed" if verified_completed else "verification_pending",
                    "message": (
                        f"Congratulations! You have completed {course_title}."
                        if verified_completed
                        else "I requested to complete the course, but the state sync is still pending."
                    ),
                    "verified": verified_completed,
                    "verification": verification,
                    **result,
                },
            }
        except ToolExecutionError as exc:
            raise self.tool_error(f"Failed to mark course as completed: {str(exc)}")
