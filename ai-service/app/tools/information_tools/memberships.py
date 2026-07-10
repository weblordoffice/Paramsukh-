from app.models.chat import ChatRequest
from app.services.backend_client import BackendClient
from app.tools.common import AppTool


class GetMembershipPlansTool(AppTool):
    name = "get_membership_plans"
    description = "List published ParamSukh membership plans, pricing, and benefits."
    parameters = {
        "type": "object",
        "properties": {},
        "required": [],
        "additionalProperties": False,
    }

    def __init__(self) -> None:
        self.backend_client = BackendClient()

    async def execute(self, arguments: dict[str, object], payload: ChatRequest) -> dict[str, object]:
        data = await self.backend_client.get_public_memberships()
        return {
            "success": True,
            "summary": f"Found {data['total']} published membership plan(s).",
            "data": data,
        }


class GetMySubscriptionTool(AppTool):
    name = "get_my_subscription"
    description = "Fetch the logged-in user's current subscription or membership status."
    parameters = {
        "type": "object",
        "properties": {},
        "required": [],
        "additionalProperties": False,
    }

    def __init__(self) -> None:
        self.backend_client = BackendClient()

    async def execute(self, arguments: dict[str, object], payload: ChatRequest) -> dict[str, object]:
        auth_token = self.require_auth_token(payload)
        data = await self.backend_client.get_user_subscription(auth_token)
        return {
            "success": True,
            "summary": "Fetched the current user's subscription details.",
            "data": data,
        }
