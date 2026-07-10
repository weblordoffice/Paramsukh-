from typing import Any

from app.models.chat import ChatRequest
from app.services.backend_client import BackendClient
from app.tools.common import AppTool


class AddAddressTool(AppTool):
    name = "add_address"
    description = (
        "Add a new delivery/shipping address to the user's account. "
        "Use this tool when the user wants to add a new address or deliver somewhere else "
        "and provides their address details."
    )
    parameters = {
        "type": "object",
        "properties": {
            "full_name": {
                "type": "string",
                "description": "The recipient's full name.",
            },
            "phone": {
                "type": "string",
                "description": "10-digit primary phone number.",
            },
            "address_line1": {
                "type": "string",
                "description": "Street address, P.O. box, company name, c/o.",
            },
            "city": {
                "type": "string",
                "description": "City or town.",
            },
            "state": {
                "type": "string",
                "description": "State, province, or region.",
            },
            "pincode": {
                "type": "string",
                "description": "Postal code / ZIP code.",
            },
            "address_type": {
                "type": "string",
                "enum": ["home", "work", "other"],
                "description": "Type of address: 'home', 'work', or 'other'. Defaults to 'home'.",
            },
            "address_line2": {
                "type": "string",
                "description": "Apartment, suite, unit, building, floor, etc. (optional).",
            },
            "landmark": {
                "type": "string",
                "description": "A nearby landmark to help locate the address (optional).",
            },
        },
        "required": ["full_name", "phone", "address_line1", "city", "state", "pincode"],
        "additionalProperties": False,
    }

    def __init__(self) -> None:
        self.backend_client = BackendClient()

    async def execute(self, arguments: dict[str, Any], payload: ChatRequest) -> dict[str, Any]:
        auth_token = payload.backend_auth_token
        if not auth_token:
            return {
                "success": False,
                "summary": "You need to be logged in to add an address.",
                "data": {"error": "auth_required"},
            }

        full_name = str(arguments.get("full_name", "")).strip()
        phone = str(arguments.get("phone", "")).strip()
        address_line1 = str(arguments.get("address_line1", "")).strip()
        city = str(arguments.get("city", "")).strip()
        state = str(arguments.get("state", "")).strip()
        pincode = str(arguments.get("pincode", "")).strip()
        address_type = str(arguments.get("address_type", "home")).strip().lower()
        address_line2 = arguments.get("address_line2")
        landmark = arguments.get("landmark")

        try:
            address = await self.backend_client.add_address(
                auth_token=auth_token,
                full_name=full_name,
                phone=phone,
                address_line1=address_line1,
                city=city,
                state=state,
                pincode=pincode,
                address_type=address_type,
                address_line2=address_line2,
                landmark=landmark,
            )
            summary = f"Address added successfully: {address_line1}, {city} ({address_type})."
            return {
                "success": True,
                "summary": summary,
                "data": {
                    "action": "address_added",
                    "address": address,
                    "address_id": address.get("id"),
                    "message": summary,
                },
            }
        except Exception as e:
            return {
                "success": False,
                "summary": f"Failed to add address: {str(e)}",
                "data": {"error": "add_address_failed", "details": str(e)},
            }
