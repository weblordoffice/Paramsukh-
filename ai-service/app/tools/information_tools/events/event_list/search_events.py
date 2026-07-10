from __future__ import annotations

from app.models.chat import ChatRequest
from app.services.backend_client import BackendClient
from app.tools.common import AppTool
from app.tools.information_tools.events.shared import (
    apply_recent_followup_filter,
    clean_search_query,
    extract_audience_focus,
    extract_recent_event_items,
    format_focus_label,
    is_broad_event_query,
    score_beginner_friendliness,
    score_event_for_focus,
    wants_beginner_recommendation,
)


class SearchEventsTool(AppTool):
    name = "search_events"
    description = "Search ParamSukh events when the user asks about upcoming, past, paid, or topic-specific events."
    parameters = {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Optional topic, keyword, or event intent. Leave empty for a broad list of available events.",
            },
            "upcoming_only": {
                "type": "boolean",
                "description": "Whether to focus only on upcoming events.",
                "default": True,
            },
        },
        "required": [],
        "additionalProperties": False,
    }

    def __init__(self) -> None:
        self.backend_client = BackendClient()

    async def execute(self, arguments: dict[str, object], payload: ChatRequest) -> dict[str, object]:
        query = str(arguments.get("query", "")).strip()
        message_text = str(payload.message or "").strip()
        upcoming_only = bool(arguments.get("upcoming_only", True))

        recent_items = extract_recent_event_items(payload)
        contextual_items, contextual_note = apply_recent_followup_filter(recent_items, message_text)
        beginner_request = wants_beginner_recommendation(message_text)
        audience_focus = extract_audience_focus(message_text)

        if contextual_items:
            items = contextual_items
            data = {
                "items": items,
                "total": len(items),
                "query": query,
                "from_recent_context": True,
            }
            broad_query = False
        else:
            broad_query = is_broad_event_query(query, message_text) or beginner_request
            search_query = None if broad_query else clean_search_query(query, message_text)
            data = await self.backend_client.get_events(search_query, upcoming_only=upcoming_only)
            items = data.get("items", [])

        if audience_focus and items:
            items = sorted(items, key=lambda item: score_event_for_focus(item, audience_focus), reverse=True)
        elif beginner_request and items:
            items = sorted(items, key=score_beginner_friendliness, reverse=True)

        paid_items = [item for item in items if item.get("is_paid")]
        free_items = [item for item in items if not item.get("is_paid")]
        beginner_recommendation = None
        if beginner_request and items:
            beginner_recommendation = {
                "id": items[0].get("id"),
                "title": items[0].get("title"),
            }

        result_data = {
            **data,
            "items": items,
            "paid_items": paid_items,
            "free_items": free_items,
            "broad_query": broad_query,
            "contextual_note": contextual_note,
            "audience_focus": audience_focus,
            "beginner_recommendation": beginner_recommendation,
        }

        if broad_query:
            summary = f"Found {len(items)} available event(s): {len(free_items)} free and {len(paid_items)} paid."
            if audience_focus and items:
                summary += f" Ranked them for {format_focus_label(audience_focus)}."
            return {"success": True, "summary": summary, "data": result_data}

        if contextual_note and beginner_recommendation:
            return {
                "success": True,
                "summary": (
                    f"{contextual_note} "
                    f"The most beginner-friendly option looks like '{beginner_recommendation['title']}'."
                ),
                "data": result_data,
            }

        if contextual_note:
            return {
                "success": True,
                "summary": f"{contextual_note} Found {len(items)} matching event(s).",
                "data": result_data,
            }

        if audience_focus and items:
            return {
                "success": True,
                "summary": (
                    f"Found {len(items)} event(s) for '{query or message_text}'. "
                    f"Ranked them for {format_focus_label(audience_focus)}."
                ),
                "data": result_data,
            }

        if beginner_recommendation:
            return {
                "success": True,
                "summary": (
                    f"Found {len(items)} event(s) for '{query or message_text}'. "
                    f"The most beginner-friendly option looks like '{beginner_recommendation['title']}'."
                ),
                "data": result_data,
            }

        return {
            "success": True,
            "summary": f"Found {len(items)} event(s) for '{query or message_text}'.",
            "data": result_data,
        }
