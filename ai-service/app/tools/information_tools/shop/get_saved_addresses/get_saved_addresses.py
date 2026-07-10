from typing import Any

from app.models.chat import ChatRequest
from app.services.backend_client import BackendClient
from app.tools.common import AppTool


class GetSavedAddressesTool(AppTool):
    name = "get_saved_addresses"
    description = "Retrieve the user's saved shipping addresses."
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
                "summary": "You need to be logged in to view your addresses.",
                "data": {"error": "auth_required"},
            }

        data = await self.backend_client.get_addresses(auth_token)
        return {
            "success": True,
            "summary": f"Found {data['total']} saved address(es).",
            "data": data,
        }
