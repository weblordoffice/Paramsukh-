from typing import Any

from app.models.chat import ChatRequest
from app.services.backend_client import BackendClient
from app.tools.common import AppTool


class SearchProductsTool(AppTool):
    name = "search_products"
    description = "Query the product catalog using text matching and multi-filter criteria."
    parameters = {
        "type": "object",
        "properties": {
            "search": {
                "type": "string",
                "description": "Optional search keyword to match product titles or descriptions.",
            },
            "category": {
                "type": "string",
                "description": "Optional category ID or name filter.",
            },
            "min_price": {
                "type": "number",
                "description": "Optional minimum price threshold.",
            },
            "max_price": {
                "type": "number",
                "description": "Optional maximum price threshold.",
            },
            "in_stock": {
                "type": "boolean",
                "description": "Optional filter to show only in-stock items.",
            },
            "rating": {
                "type": "number",
                "description": "Optional minimum average rating threshold.",
            },
        },
        "required": [],
        "additionalProperties": False,
    }

    def __init__(self) -> None:
        self.backend_client = BackendClient()

    async def execute(self, arguments: dict[str, Any], payload: ChatRequest) -> dict[str, Any]:
        # --- Search keyword cleanup ---
        search_raw = str(arguments.get("search", "")).strip()
        search: str | None = None
        if search_raw:
            normalized_search = (
                search_raw.lower()
                .replace("available", "")
                .replace("all", "")
                .replace("products", "")
                .replace("product", "")
                .replace("items", "")
                .replace("item", "")
                .replace("shop", "")
                .replace("store", "")
                .strip()
            )
            search = normalized_search if normalized_search else None

        # --- Category cleanup ---
        category_raw = str(arguments.get("category", "")).strip()
        category: str | None = category_raw if category_raw else None

        # --- Numeric filters: treat 0 (or missing) as "no filter" ---
        raw_min = arguments.get("min_price")
        raw_max = arguments.get("max_price")
        raw_rating = arguments.get("rating")

        min_price: float | None = float(raw_min) if raw_min is not None and float(raw_min) > 0 else None
        max_price: float | None = float(raw_max) if raw_max is not None and float(raw_max) > 0 else None
        rating: float | None = float(raw_rating) if raw_rating is not None and float(raw_rating) > 0 else None

        # --- in_stock: only apply if explicitly True (not just because "available" was in message) ---
        in_stock_raw = arguments.get("in_stock")
        in_stock: bool | None = True if in_stock_raw is True else None

        data = await self.backend_client.search_products(
            query=search,
            category=category,
            min_price=min_price,
            max_price=max_price,
            in_stock=in_stock,
            rating=rating,
        )

        return {
            "success": True,
            "summary": f"Found {data['total']} product(s).",
            "data": data,
        }

