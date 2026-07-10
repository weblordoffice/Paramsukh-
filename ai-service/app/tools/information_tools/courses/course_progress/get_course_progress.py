from app.models.chat import ChatRequest
from app.tools.information_tools.courses.shared import CourseInformationTool, resolve_course_target


class GetCourseProgressTool(CourseInformationTool):
    name = "get_course_progress"
    description = (
        "Get detailed progress for a specific enrolled course when the user asks how far they are, "
        "what they completed, or where they left off."
    )
    parameters = {
        "type": "object",
        "properties": {
            "course_id": {
                "type": "string",
                "description": "The course id from a previous course or enrollment tool result.",
            },
            "course_title": {
                "type": "string",
                "description": "Optional course title reference when the user says a course name or follow-up phrase like this course.",
            }
        },
        "required": [],
        "additionalProperties": False,
    }

    async def execute(self, arguments: dict[str, object], payload: ChatRequest) -> dict[str, object]:
        auth_token = self.require_auth_token(payload)
        course_id = str(arguments.get("course_id", "")).strip() or None
        course_title = str(arguments.get("course_title", "")).strip() or None
        resolved_course_id, resolved_course_title = resolve_course_target(payload, course_id, course_title)
        if not resolved_course_id:
            raise self.tool_error(
                "I could not tell which course you meant. Please share the course name or ask me to show your enrolled courses first."
            )

        data = await self.backend_client.get_course_progress(auth_token, resolved_course_id)
        if resolved_course_title:
            data["course_title"] = resolved_course_title
        percentage = data.get("percentage")
        summary = (
            f"I pulled the latest progress for {resolved_course_title or 'that course'}."
            if percentage is None
            else f"{resolved_course_title or 'That course'} is {percentage}% complete right now."
        )
        return {
            "success": True,
            "summary": summary,
            "data": data,
        }
