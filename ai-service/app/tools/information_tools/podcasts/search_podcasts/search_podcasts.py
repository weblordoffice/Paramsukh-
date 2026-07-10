from app.models.chat import ChatRequest
from app.services.backend_client import BackendClient
from app.tools.common import AppTool


class SearchPodcastsTool(AppTool):
    name = "search_podcasts"
    description = "Find podcasts relevant to the user's question, either public or accessible to the signed-in user."
    parameters = {
        "type": "object",
        "properties": {
            "category": {
                "type": "string",
                "description": "Optional category filter for podcasts.",
            },
            "accessible_only": {
                "type": "boolean",
                "description": "Whether to only fetch podcasts available to the current logged-in user.",
                "default": False,
            },
        },
        "required": [],
        "additionalProperties": False,
    }

    def __init__(self) -> None:
        self.backend_client = BackendClient()

    async def execute(self, arguments: dict[str, object], payload: ChatRequest) -> dict[str, object]:
        category = str(arguments.get("category", "")).strip() or None
        accessible_only = bool(arguments.get("accessible_only", False))

        if accessible_only:
            auth_token = self.require_auth_token(payload)
            data = await self.backend_client.get_user_accessible_podcasts(auth_token)
        else:
            data = await self.backend_client.get_public_podcasts(category)

        return {
            "success": True,
            "summary": f"Found {data['total']} podcast(s).",
            "data": data,
        }
