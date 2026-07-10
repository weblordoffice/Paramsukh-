from app.core.exceptions import ToolExecutionError
from app.models.chat import ChatRequest
from app.services.backend_client import BackendClient
from app.tools.common import AppTool


class StartMembershipPurchaseTool(AppTool):
    name = "start_membership_purchase"
    description = (
        "Create a hosted payment step for a specific ParamSukh membership plan after the user explicitly confirms they want to buy it."
    )
    parameters = {
        "type": "object",
        "properties": {
            "plan": {
                "type": "string",
                "description": "The membership plan slug from a previous membership tool result, such as bronze, copper, or silver.",
            },
            "variant_slug": {
                "type": "string",
                "description": "Optional membership variant slug when the plan has multiple purchasable variants.",
            },
            "user_confirmed": {
                "type": "boolean",
                "description": "True only when the user clearly confirmed they want to proceed with this membership purchase.",
            },
        },
        "required": ["plan", "user_confirmed"],
        "additionalProperties": False,
    }

    def __init__(self) -> None:
        self.backend_client = BackendClient()

    async def execute(self, arguments: dict[str, object], payload: ChatRequest) -> dict[str, object]:
        auth_token = self.require_auth_token(payload)
        plan = str(arguments.get("plan", "")).strip().lower()
        variant_slug = str(arguments.get("variant_slug", "")).strip() or None
        user_confirmed = bool(arguments.get("user_confirmed", False))

        if not plan:
            raise self.tool_error("plan is required")
        if not user_confirmed:
            raise self.tool_error("I need your confirmation before starting a membership purchase.")

        try:
            payment_link = await self.backend_client.create_membership_payment_link(
                auth_token,
                plan,
                variant_slug=variant_slug,
            )
        except ToolExecutionError as exc:
            message = str(exc).strip() or "I could not start the membership payment right now."
            lowered = message.lower()
            normalized_message = (
                "That membership plan is not available right now. Please choose a different plan."
                if "invalid membership plan" in lowered
                else "I could not start the membership payment right now. Please try again shortly."
            )
            return {
                "success": True,
                "summary": "The membership purchase flow could not be started.",
                "data": {
                    "action": "membership_purchase_unavailable",
                    "plan": plan,
                    "variant_slug": variant_slug,
                    "status": "failed",
                    "message": normalized_message,
                    "raw_message": message,
                },
            }

        return {
            "success": True,
            "summary": "Created a payment link for the membership plan.",
            "data": {
                "action": "membership_payment_link_created",
                "plan": plan,
                "variant_slug": variant_slug,
                "payment_required": True,
                **payment_link,
            },
        }
