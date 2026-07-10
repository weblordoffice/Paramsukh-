from app.models.chat import ChatRequest
from app.tools.information_tools.courses.shared import CourseInformationTool, clamp_limit


class GetContinueLearningTool(CourseInformationTool):
    name = "get_continue_learning"
    description = (
        "Get the logged-in user's in-progress courses that they are most likely to continue next."
    )
    parameters = {
        "type": "object",
        "properties": {
            "limit": {
                "type": "integer",
                "description": "Maximum number of in-progress courses to return.",
                "minimum": 1,
                "maximum": 10,
                "default": 5,
            }
        },
        "required": [],
        "additionalProperties": False,
    }

    async def execute(self, arguments: dict[str, object], payload: ChatRequest) -> dict[str, object]:
        auth_token = self.require_auth_token(payload)
        limit = clamp_limit(arguments.get("limit", 5), default=5, minimum=1, maximum=10)
        data = await self.backend_client.get_continue_learning(auth_token, limit=limit)
        total = int(data.get("total", 0))
        return {
            "success": True,
            "summary": (
                "You are all caught up for now."
                if total == 0
                else f"I found {total} course(s) you can continue next based on your recent learning activity."
            ),
            "data": data,
        }
