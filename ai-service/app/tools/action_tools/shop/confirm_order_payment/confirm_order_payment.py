from typing import Any

from app.models.chat import ChatRequest
from app.services.backend_client import BackendClient
from app.tools.common import AppTool


class ConfirmOrderPaymentTool(AppTool):
    name = "confirm_order_payment"
    description = (
        "Verify online Razorpay payment status for a shop order and mark it confirmed. "
        "Use this tool when the user says they have completed the payment, paid successfully, "
        "or asks you to verify their payment status for an online order."
    )
    parameters = {
        "type": "object",
        "properties": {
            "order_id": {
                "type": "string",
                "description": "The unique database ID of the order to confirm.",
            },
            "payment_link_id": {
                "type": "string",
                "description": "The unique Razorpay payment link ID associated with the order.",
            },
        },
        "required": ["order_id", "payment_link_id"],
        "additionalProperties": False,
    }

    def __init__(self) -> None:
        self.backend_client = BackendClient()

    async def execute(self, arguments: dict[str, Any], payload: ChatRequest) -> dict[str, Any]:
        auth_token = payload.backend_auth_token
        if not auth_token:
            return {
                "success": False,
                "summary": "You need to be logged in to confirm an order payment.",
                "data": {"error": "auth_required"},
            }

        order_id = str(arguments.get("order_id", "")).strip()
        payment_link_id = str(arguments.get("payment_link_id", "")).strip()

        if not order_id or not payment_link_id:
            return {
                "success": False,
                "summary": "Order ID and Payment Link ID are required to verify payment.",
                "data": {"error": "missing_ids"},
            }

        try:
            res = await self.backend_client.confirm_order_payment(
                auth_token=auth_token,
                order_id=order_id,
                payment_link_id=payment_link_id,
            )
            order_data = res.get("data", {}).get("order") or {}
            
            # Check if order status is confirmed (meaning paid successfully)
            status = order_data.get("status") or ""
            if status == "confirmed":
                order_number = order_data.get("orderNumber") or "ORD-PAID"
                total = order_data.get("pricing", {}).get("total") or 0.0
                summary = f"Payment verified! Order #{order_number} has been confirmed successfully."
                return {
                    "success": True,
                    "summary": summary,
                    "data": {
                        "action": "order_confirmed",
                        "order_id": order_id,
                        "order_number": order_number,
                        "payment_method": "razorpay",
                        "total": total,
                        "message": summary,
                    },
                }
            else:
                summary = f"Payment is not completed yet. (Status: {res.get('data', {}).get('status') or 'unknown'})"
                return {
                    "success": True,
                    "summary": summary,
                    "data": {
                        "action": "payment_pending",
                        "order_id": order_id,
                        "order_number": order_data.get("orderNumber"),
                        "message": summary,
                    },
                }
        except Exception as e:
            return {
                "success": False,
                "summary": f"Failed to verify payment: {str(e)}",
                "data": {"error": "verification_failed", "details": str(e)},
            }
