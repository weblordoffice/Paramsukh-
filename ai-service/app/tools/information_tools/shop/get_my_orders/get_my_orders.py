from typing import Any

from app.models.chat import ChatRequest
from app.services.backend_client import BackendClient
from app.tools.common import AppTool


class GetMyOrdersTool(AppTool):
    name = "get_my_orders"
    description = "Retrieve the user's order history containing past and pending orders."
    parameters = {
        "type": "object",
        "properties": {},
        "required": [],
        "additionalProperties": False,
    }

    def __init__(self) -> None:
        self.backend_client = BackendClient()

    async def execute(self, arguments: dict[str, Any], payload: ChatRequest) -> dict[str, Any]:
        auth_token = payload.backend_auth_token
        if not auth_token:
            return {
                "success": False,
                "summary": "You need to be logged in to view your orders.",
                "data": {"error": "auth_required"},
            }

        data = await self.backend_client.get_my_orders(auth_token)
        return {
            "success": True,
            "summary": f"Retrieved {data['total']} order(s) successfully.",
            "data": data,
        }
