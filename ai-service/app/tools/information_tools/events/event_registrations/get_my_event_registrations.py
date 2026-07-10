from __future__ import annotations

from app.models.chat import ChatRequest
from app.services.backend_client import BackendClient
from app.tools.common import AppTool


class GetMyEventRegistrationsTool(AppTool):
    name = "get_my_event_registrations"
    description = (
        "Get the logged-in user's event registrations when they ask about booked, upcoming, past, "
        "or paid event participation."
    )
    parameters = {
        "type": "object",
        "properties": {
            "status": {
                "type": "string",
                "description": "Optional registration status filter such as confirmed, pending, or cancelled.",
            },
            "upcoming_only": {
                "type": "boolean",
                "description": "Whether to only return future event registrations.",
                "default": False,
            },
            "past_only": {
                "type": "boolean",
                "description": "Whether to only return past event registrations.",
                "default": False,
            },
        },
        "required": [],
        "additionalProperties": False,
    }

    def __init__(self) -> None:
        self.backend_client = BackendClient()

    async def execute(self, arguments: dict[str, object], payload: ChatRequest) -> dict[str, object]:
        auth_token = self.require_auth_token(payload)
        status = str(arguments.get("status", "")).strip() or None
        upcoming_only = bool(arguments.get("upcoming_only", False))
        past_only = bool(arguments.get("past_only", False))

        if upcoming_only and past_only:
            raise self.tool_error("upcoming_only and past_only cannot both be true")

        data = await self.backend_client.get_my_event_registrations(
            auth_token,
            status=status,
            upcoming_only=upcoming_only,
            past_only=past_only,
        )
        return {
            "success": True,
            "summary": f"Found {data['total']} event registration(s).",
            "data": data,
        }
