"""
Tool: search_counseling_services

Retrieves all active counseling and therapy services available on the
ParamSukh platform, including specialization areas, counselor names,
session durations, and pricing. The tool does not require authentication
since the services endpoint is public.
"""
from __future__ import annotations

from app.models.chat import ChatRequest
from app.tools.information_tools.counseling.shared import (
    CounselingInformationTool,
    normalize_service_query,
    price_label,
)


class SearchCounselingServicesTool(CounselingInformationTool):
    name = "search_counseling_services"
    description = (
        "Retrieve and discover available counseling and therapy services on ParamSukh. "
        "Use this when the user asks about counseling options, therapy types, spiritual guidance, "
        "relationship counseling, or wants to know what sessions are available to book."
    )
    parameters = {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": (
                    "Optional search term to filter services by specialization area, "
                    "counselor name, or therapy type. Leave empty to return all services."
                ),
            },
        },
        "additionalProperties": False,
    }

    async def execute(
        self,
        arguments: dict[str, object],
        payload: ChatRequest,
    ) -> dict[str, object]:
        raw_query = str(arguments.get("query", "") or "").strip()
        query = normalize_service_query(raw_query)

        catalog = await self.backend_client.get_counseling_services()
        items: list[dict] = catalog.get("items") or []

        # Optional keyword filter when a meaningful query is given
        if query:
            q_lower = query.lower()
            filtered = [
                svc
                for svc in items
                if q_lower in (svc.get("title") or "").lower()
                or q_lower in (svc.get("description") or "").lower()
                or q_lower in (svc.get("counselor_name") or "").lower()
            ]
        else:
            filtered = items

        # Enrich each service with a formatted price label for rendering
        enriched = [
            {
                **svc,
                "price_label": price_label(svc),
            }
            for svc in filtered
        ]

        total = len(enriched)

        if total == 0 and query:
            summary = (
                f"No counseling services matched '{raw_query}'. "
                "Here are all available services instead."
            )
            # Fall back to full list so the user always sees something useful
            enriched = [{**svc, "price_label": price_label(svc)} for svc in items]
            total = len(enriched)
        elif total == 1:
            summary = f"Found 1 counseling service: {enriched[0].get('title', 'Counseling Session')}."
        elif total > 1:
            summary = f"Found {total} counseling services available for booking."
        else:
            summary = "No counseling services are currently available."

        return {
            "success": True,
            "summary": summary,
            "data": {
                "items": enriched,
                "total": total,
                "query": query or None,
            },
        }
