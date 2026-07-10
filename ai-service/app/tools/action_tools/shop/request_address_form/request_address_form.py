from typing import Any

from app.models.chat import ChatRequest
from app.tools.common import AppTool


class RequestAddressFormTool(AppTool):
    name = "request_address_form"
    description = (
        "Show an interactive address entry form to the user in the chat interface. "
        "Use this tool when the user wants to add a new delivery address, deliver somewhere else, "
        "or enter their shipping/address details during checkout."
    )
    parameters = {
        "type": "object",
        "properties": {},
        "additionalProperties": False,
    }

    async def execute(self, arguments: dict[str, Any], payload: ChatRequest) -> dict[str, Any]:
        summary = "Presented the address entry form."
        return {
            "success": True,
            "summary": summary,
            "data": {
                "action": "show_form",
                "message": summary,
            },
        }
