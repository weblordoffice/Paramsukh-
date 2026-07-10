from typing import Any

from app.models.chat import ChatRequest
from app.services.backend_client import BackendClient
from app.tools.common import AppTool
from app.core.exceptions import ToolExecutionError


class GetCommunityGroupsTool(AppTool):
    name = "get_community_groups"
    description = (
        "Retrieve the list of active discussion groups and communities the user belongs to. "
        "Use this tool when the user wants to browse their discussion circles, check community groups, "
        "or view group details like description and member count."
    )
    parameters = {
        "type": "object",
        "properties": {},
        "additionalProperties": False,
    }

    async def execute(self, arguments: dict[str, Any], payload: ChatRequest) -> dict[str, Any]:
        auth_token = self.require_auth_token(payload)

        client = BackendClient()
        try:
            res = await client.get_my_groups(auth_token)
            total = res.get("total", 0)
            if total == 0:
                summary = "I checked your community access, but there are no active groups yet."
            elif total == 1:
                summary = "I found 1 active community group for you."
            else:
                summary = f"I found {total} active community groups for you."
            return {
                "success": True,
                "summary": summary,
                "data": {
                    **res,
                    "follow_up": (
                        "If you want, I can also open the latest discussion feed for one of these groups."
                        if total > 0
                        else "If you want, I can also help you understand how community access works in ParamSukh."
                    ),
                },
            }
        except ToolExecutionError as exc:
            raise exc
        except Exception:
            return {
                "success": False,
                "message": "I could not load your community groups right now. Please try again in a moment.",
            }
