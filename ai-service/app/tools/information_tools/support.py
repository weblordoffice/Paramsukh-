from app.models.chat import ChatRequest
from app.services.backend_client import BackendClient
from app.tools.common import AppTool
from app.tools.support_content import SUPPORT_CONTENT


class GetSupportMessagesTool(AppTool):
    name = "get_support_messages"
    description = "Fetch the logged-in user's support tickets or support message history."
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
        data = await self.backend_client.get_support_messages(auth_token)
        return {
            "success": True,
            "summary": f"Found {data['total']} support message(s).",
            "data": data,
        }


class SearchSupportContentTool(AppTool):
    name = "search_support_content"
    description = (
        "Search ParamSukh FAQ, contact, and help-resource content when users ask how to do something "
        "or need support guidance that does not require opening their personal support tickets."
    )
    parameters = {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "The user's support or help question.",
            }
        },
        "required": ["query"],
        "additionalProperties": False,
    }

    @staticmethod
    def _score_item(query: str, item: dict[str, object]) -> int:
        score = 0
        query_lower = query.lower()
        title = str(item.get("title") or "").lower()
        content = str(item.get("content") or "").lower()
        keywords = [str(keyword).lower() for keyword in item.get("keywords") or []]

        if query_lower in title:
            score += 7
        if query_lower in content:
            score += 5
        score += sum(3 for keyword in keywords if keyword in query_lower)
        score += sum(1 for word in query_lower.split() if word and word in title)
        return score

    async def execute(self, arguments: dict[str, object], payload: ChatRequest) -> dict[str, object]:
        query = str(arguments.get("query", "")).strip()
        if not query:
            raise self.tool_error("query is required")

        ranked = sorted(
            (
                {**item, "relevance_score": self._score_item(query, item)}
                for item in SUPPORT_CONTENT
            ),
            key=lambda item: item["relevance_score"],
            reverse=True,
        )
        items = [
            {
                "id": item["id"],
                "type": item["type"],
                "title": item["title"],
                "content": item["content"],
            }
            for item in ranked
            if item["relevance_score"] > 0
        ][:5]

        return {
            "success": True,
            "summary": f"Found {len(items)} support content item(s) relevant to '{query}'.",
            "data": {
                "items": items,
                "total": len(items),
                "query": query,
            },
        }
