from app.models.chat import ChatRequest
from app.tools.information_tools.courses.shared import CourseInformationTool, clamp_limit


class GetMyEnrollmentsTool(CourseInformationTool):
    name = "get_my_enrollments"
    description = (
        "Get the logged-in user's enrolled courses with progress, learning status, and recent activity."
    )
    parameters = {
        "type": "object",
        "properties": {
            "status": {
                "type": "string",
                "description": "Optional enrollment status filter.",
                "enum": ["all", "in_progress", "completed"],
                "default": "all",
            },
            "limit": {
                "type": "integer",
                "description": "Maximum number of enrolled courses to return.",
                "minimum": 1,
                "maximum": 12,
                "default": 8,
            },
        },
        "additionalProperties": False,
    }

    async def execute(self, arguments: dict[str, object], payload: ChatRequest) -> dict[str, object]:
        auth_token = self.require_auth_token(payload)
        status = str(arguments.get("status", "all")).strip().lower() or "all"
        limit = clamp_limit(arguments.get("limit", 8), default=8, minimum=1, maximum=12)

        data = await self.backend_client.get_my_enrollments(
            auth_token,
            completed_only=status == "completed",
            in_progress_only=status == "in_progress",
            limit=limit,
        )

        total = int(data.get("total", 0))
        visible_count = int(data.get("visible_count", total))
        if total == 0:
            if status == "completed":
                summary = "You do not have any completed courses yet."
            elif status == "in_progress":
                summary = "You do not have any in-progress courses right now."
            else:
                summary = "You are not enrolled in any courses yet."
        else:
            status_prefix = {
                "completed": "Here are your completed courses.",
                "in_progress": "Here are the courses you are actively learning.",
                "all": "Here is your learning snapshot.",
            }.get(status, "Here is your learning snapshot.")
            visible_suffix = f" Showing your top {visible_count} right now." if visible_count < total else ""
            summary = (
                f"{status_prefix} You have {total} enrolled course(s): "
                f"{data['in_progress_count']} in progress, "
                f"{data['completed_count']} completed, and "
                f"{data['not_started_count']} not started, with an average progress of {data['average_progress']}%."
                f"{visible_suffix}"
            )

        return {
            "success": True,
            "summary": summary,
            "data": data,
        }
