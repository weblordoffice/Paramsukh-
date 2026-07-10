from app.core.exceptions import ToolExecutionError
from app.models.chat import ChatRequest
from app.tools.action_tools.courses.shared import CourseActionTool


class EnrollInCourseTool(CourseActionTool):
    name = "enroll_in_course"
    description = (
        "Enroll the logged-in user into a specific ParamSukh course after the user explicitly confirms they want to join it."
    )
    parameters = {
        "type": "object",
        "properties": {
            "course_id": {
                "type": "string",
                "description": "The course id from a previous course search, recommendation, or enrollment-related tool result.",
            },
            "course_title": {
                "type": "string",
                "description": "Optional course title when the user names a course directly or refers to a recent course result.",
            },
            "user_confirmed": {
                "type": "boolean",
                "description": "True only when the user clearly confirmed they want to enroll in this course.",
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

        resolved_course_id, course = await self.resolve_course_action_target(
            payload,
            course_id=requested_course_id,
            course_title=requested_course_title,
            auth_token=auth_token,
        )
        if not resolved_course_id:
            raise self.tool_error(
                "I could not tell which course you want to enroll in. Please mention the course name or ask me to show the course list first."
            )

        course_title = str((course or {}).get("title") or requested_course_title or resolved_course_id).strip()
        access = (course or {}).get("access") if isinstance(course, dict) else {}
        access = access if isinstance(access, dict) else {}
        course_payload = self.format_course_payload(course, resolved_course_id)

        if access.get("reason") == "already_enrolled":
            return {
                "success": True,
                "summary": "You are already enrolled in this course.",
                "data": {
                    "action": "already_enrolled",
                    "course_id": resolved_course_id,
                    "course": course_payload,
                    "status": "already_enrolled",
                    "message": "You are already enrolled in this course, so you can continue learning anytime.",
                    "upgrade_required": False,
                },
            }

        blocked_precheck = self._precheck_blocked_outcome(
            access=access,
            course=course_payload,
            course_id=resolved_course_id,
        )
        if blocked_precheck:
            if blocked_precheck.get("data", {}).get("upgrade_required"):
                plans = await self.backend_client.get_public_memberships()
                blocked_precheck["data"]["membership_plans"] = plans.get("items", [])
            return blocked_precheck

        if not user_confirmed:
            return {
                "success": True,
                "summary": f"{course_title} is ready for enrollment once you confirm.",
                "data": {
                    "action": "confirmation_required",
                    "course_id": resolved_course_id,
                    "course": course_payload,
                    "status": "confirmation_required",
                    "message": f"I found {course_title}. If you want me to enroll you, just confirm and I will proceed.",
                    "upgrade_required": False,
                },
            }

        try:
            prior_status = await self.backend_client.get_course_enrollment_status(auth_token, resolved_course_id)
            if prior_status.get("is_enrolled"):
                return {
                    "success": True,
                    "summary": "You are already enrolled in this course.",
                    "data": {
                        "action": "already_enrolled",
                        "course_id": resolved_course_id,
                        "course": course_payload,
                        "status": "already_enrolled",
                        "message": "You are already enrolled in this course, so you can continue learning anytime.",
                        "upgrade_required": False,
                        "verification": prior_status,
                    },
                }

            enrollment = await self.backend_client.enroll_in_course(auth_token, resolved_course_id)
            verification = await self.backend_client.get_course_enrollment_status(auth_token, resolved_course_id)
            verified_enrolled = bool(verification.get("is_enrolled"))
            return {
                "success": True,
                "summary": (
                    enrollment.get("message") or "Successfully enrolled in the course."
                    if verified_enrolled
                    else "The enrollment request completed, but I could not fully verify the course access yet."
                ),
                "data": {
                    "action": "course_enrolled" if verified_enrolled else "enrollment_pending_verification",
                    "course_id": resolved_course_id,
                    "course": {
                        **course_payload,
                        **(enrollment.get("course") or {}),
                    },
                    "status": "enrolled" if verified_enrolled else "verification_pending",
                    "message": (
                        "You are enrolled and can start learning now."
                        if verified_enrolled
                        else "I sent the enrollment request, but I could not confirm the access state yet. Please refresh or try again once."
                    ),
                    "upgrade_required": False,
                    "verified": verified_enrolled,
                    "verification": verification,
                    **enrollment,
                },
            }
        except ToolExecutionError as exc:
            message = str(exc)
            normalized = await self._normalize_enrollment_issue(
                message,
                auth_token=auth_token,
                course_id=resolved_course_id,
                course=course_payload,
            )
            return {
                "success": True,
                "summary": normalized["summary"],
                "data": {
                    "action": normalized["action"],
                    "course_id": resolved_course_id,
                    "course": course_payload,
                    "status": normalized["status"],
                    "message": normalized["message"],
                    "upgrade_required": normalized["upgrade_required"],
                    "access_reason": normalized.get("access_reason"),
                    "restricted_plan": normalized.get("restricted_plan", False),
                    "membership_plans": normalized.get("membership_plans"),
                },
            }

    async def _normalize_enrollment_issue(
        self,
        message: str,
        *,
        auth_token: str,
        course_id: str,
        course: dict[str, object],
    ) -> dict[str, object]:
        text = (message or "").strip() or "I could not complete the enrollment right now."
        lowered = text.lower()

        if "already enrolled" in lowered:
            return {
                "action": "already_enrolled",
                "status": "already_enrolled",
                "summary": "The user is already enrolled in this course.",
                "message": "You are already enrolled in this course, so you can continue learning anytime.",
                "upgrade_required": False,
            }

        if any(term in lowered for term in ("upgrade", "membership", "plan", "include this course", "manual enrollment")):
            plans = await self.backend_client.get_public_memberships()
            access_reason = None
            access = course.get("access") if isinstance(course.get("access"), dict) else {}
            if isinstance(access, dict):
                access_reason = access.get("reason")
            return {
                "action": "restricted_plan" if "manual enrollment" in lowered else "upgrade_required",
                "status": "restricted_plan" if "manual enrollment" in lowered else "blocked",
                "summary": (
                    "This course needs a different membership setup before enrollment can continue."
                    if "manual enrollment" in lowered
                    else "The user's current access does not allow this enrollment yet."
                ),
                "message": text,
                "upgrade_required": True,
                "restricted_plan": "manual enrollment" in lowered,
                "access_reason": access_reason,
                "membership_plans": plans.get("items", []),
            }

        if "not found" in lowered:
            return {
                "action": "course_unavailable",
                "status": "unavailable",
                "summary": "The requested course could not be found.",
                "message": "I could not find that course anymore. Please choose another one from the latest list.",
                "upgrade_required": False,
            }

        if "not available" in lowered:
            return {
                "action": "course_unavailable",
                "status": "unavailable",
                "summary": "The requested course is not open for enrollment right now.",
                "message": "This course is not available for enrollment right now.",
                "upgrade_required": False,
            }

        return {
            "action": "enrollment_unavailable",
            "status": "failed",
            "summary": "The course enrollment could not be completed right now.",
            "message": "I could not enroll you in that course right now. Please try again shortly.",
            "upgrade_required": False,
        }

    def _precheck_blocked_outcome(
        self,
        *,
        access: dict[str, object],
        course: dict[str, object],
        course_id: str,
    ) -> dict[str, object] | None:
        can_enroll = access.get("canEnroll")
        reason = str(access.get("reason") or "").strip()
        message = str(access.get("message") or "").strip()
        if can_enroll is True or not reason:
            return None

        if reason in {"plan_required", "course_not_included"}:
            return {
                "success": True,
                "summary": "This course needs membership access before I can enroll you.",
                "data": {
                    "action": "upgrade_required",
                    "course_id": course_id,
                    "course": course,
                    "status": "blocked",
                    "message": message or "This course requires a membership upgrade before enrollment can continue.",
                    "upgrade_required": True,
                    "access_reason": reason,
                },
            }

        if reason == "auto_enroll_only":
            return {
                "success": True,
                "summary": "This membership does not allow manual enrollment for that course.",
                "data": {
                    "action": "restricted_plan",
                    "course_id": course_id,
                    "course": course,
                    "status": "restricted_plan",
                    "message": message or "Your membership includes pre-selected courses, so manual enrollment is not available for this course.",
                    "upgrade_required": True,
                    "restricted_plan": True,
                    "access_reason": reason,
                },
            }

        if reason == "already_enrolled":
            return {
                "success": True,
                "summary": "You are already enrolled in this course.",
                "data": {
                    "action": "already_enrolled",
                    "course_id": course_id,
                    "course": course,
                    "status": "already_enrolled",
                    "message": "You are already enrolled in this course, so you can continue learning anytime.",
                    "upgrade_required": False,
                    "access_reason": reason,
                },
            }

        return None
