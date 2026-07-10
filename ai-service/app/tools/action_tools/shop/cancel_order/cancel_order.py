from typing import Any

from app.models.chat import ChatRequest
from app.services.backend_client import BackendClient
from app.tools.common import AppTool


class CancelOrderTool(AppTool):
    name = "cancel_order"
    description = (
        "Cancel a pending or confirmed shop purchase order. "
        "Always call with user_confirmed=false first to verify and prompt for cancellation confirmation. "
        "Only call with user_confirmed=true when the user explicitly confirms they want to proceed."
    )
    parameters = {
        "type": "object",
        "properties": {
            "order_id": {
                "type": "string",
                "description": "The unique database ID of the order to cancel.",
            },
            "order_number": {
                "type": "string",
                "description": "Optional human-readable order number (e.g., ORD2607312345).",
            },
            "reason": {
                "type": "string",
                "description": "Optional cancellation reason provided by the user.",
            },
            "user_confirmed": {
                "type": "boolean",
                "description": "Must be set to True only when the user explicitly confirms the cancellation.",
            },
        },
        "required": ["order_id", "user_confirmed"],
        "additionalProperties": False,
    }

    def __init__(self) -> None:
        self.backend_client = BackendClient()

    async def execute(self, arguments: dict[str, Any], payload: ChatRequest) -> dict[str, Any]:
        auth_token = payload.backend_auth_token
        if not auth_token:
            return {
                "success": False,
                "summary": "You need to be logged in to cancel an order.",
                "data": {"error": "auth_required"},
            }

        order_id = str(arguments.get("order_id", "")).strip()
        order_number = arguments.get("order_number") or "Unknown"
        reason = arguments.get("reason") or "User requested cancellation"
        user_confirmed = bool(arguments.get("user_confirmed", False))

        if not order_id:
            return {
                "success": False,
                "summary": "Order ID is required to cancel an order.",
                "data": {"error": "missing_order_id"},
            }

        # --- STEP 1: Confirmation Required ---
        if not user_confirmed:
            summary = f"Are you sure you want to cancel order #{order_number}? This action cannot be undone."
            return {
                "success": True,
                "summary": summary,
                "data": {
                    "action": "confirmation_required",
                    "order_id": order_id,
                    "order_number": order_number,
                    "reason": reason,
                    "message": summary,
                },
            }

        # --- STEP 2: Execute Cancellation ---
        try:
            res = await self.backend_client.cancel_order(auth_token, order_id, reason)
            summary = f"Order #{order_number} has been cancelled successfully."
            return {
                "success": True,
                "summary": summary,
                "data": {
                    "action": "cancelled",
                    "order_id": order_id,
                    "order_number": order_number,
                    "message": summary,
                },
            }
        except Exception as e:
            return {
                "success": False,
                "summary": f"Failed to cancel order: {str(e)}",
                "data": {"error": "cancellation_failed", "details": str(e)},
            }
