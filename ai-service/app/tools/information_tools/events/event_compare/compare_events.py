from __future__ import annotations

from app.models.chat import ChatRequest
from app.services.backend_client import BackendClient
from app.tools.common import AppTool
from app.tools.information_tools.events.shared import (
    extract_audience_focus,
    format_focus_label,
    is_weekend,
    resolve_event_pair,
    score_event_for_focus,
)


class CompareEventsTool(AppTool):
    name = "compare_events"
    description = (
        "Compare two ParamSukh events and explain which one is a better fit for beginners, families, "
        "working professionals, or value-focused users."
    )
    parameters = {
        "type": "object",
        "properties": {
            "first_event_id": {"type": "string", "description": "Optional id of the first event."},
            "second_event_id": {"type": "string", "description": "Optional id of the second event."},
            "first_event_title": {"type": "string", "description": "Optional title of the first event."},
            "second_event_title": {"type": "string", "description": "Optional title of the second event."},
            "comparison_focus": {
                "type": "string",
                "description": "Optional comparison focus such as beginners, families, working_professionals, or value.",
            },
        },
        "required": [],
        "additionalProperties": False,
    }

    def __init__(self) -> None:
        self.backend_client = BackendClient()

    async def execute(self, arguments: dict[str, object], payload: ChatRequest) -> dict[str, object]:
        message_text = str(payload.message or "").strip()
        items, note = resolve_event_pair(
            payload,
            str(arguments.get("first_event_id", "")).strip() or None,
            str(arguments.get("second_event_id", "")).strip() or None,
            str(arguments.get("first_event_title", "")).strip() or None,
            str(arguments.get("second_event_title", "")).strip() or None,
            message_text,
        )
        if len(items) < 2:
            raise self.tool_error(
                "I need two specific events to compare. Please mention both event names or point to two events from the recent list."
            )

        detailed_items = []
        for item in items[:2]:
            event_id = str(item.get("id") or item.get("event_id") or "").strip()
            if not event_id:
                continue
            detailed_items.append(await self.backend_client.get_event_detail(event_id))

        if len(detailed_items) < 2:
            raise self.tool_error("I could not load both events for comparison right now. Please try again.")

        focus = str(arguments.get("comparison_focus", "")).strip() or extract_audience_focus(message_text) or "value"
        ranked_items = sorted(detailed_items, key=lambda item: score_event_for_focus(item, focus), reverse=True)
        recommended = ranked_items[0]
        alternative = ranked_items[1]

        reason_parts = []
        if focus == "beginners":
            reason_parts.append("clear beginner friendliness")
        elif focus == "families":
            reason_parts.append("family fit and easier timing")
        elif focus == "working_professionals":
            reason_parts.append("schedule flexibility and convenience")
        elif focus == "value":
            reason_parts.append("price-to-experience value")
        if not recommended.get("is_paid"):
            reason_parts.append("free access")
        if is_weekend(str(recommended.get("event_date") or "")):
            reason_parts.append("weekend timing")
        if str(recommended.get("location_type") or "").lower() == "online":
            reason_parts.append("online convenience")

        comparison_rows = [
            {"label": "Focus", "value": format_focus_label(focus)},
            {"label": "Best Match", "value": str(recommended.get("title") or "Recommended event")},
            {"label": "Alternative", "value": str(alternative.get("title") or "Alternative event")},
            {"label": "Why", "value": ", ".join(reason_parts) or "overall fit"},
        ]

        return {
            "success": True,
            "summary": (
                f"{note + ' ' if note else ''}"
                f"For {format_focus_label(focus)}, '{recommended.get('title')}' looks stronger than '{alternative.get('title')}'."
            ),
            "data": {
                "focus": focus,
                "rows": comparison_rows,
                "recommended_event_id": recommended.get("id"),
                "recommended_event_title": recommended.get("title"),
                "items": ranked_items,
            },
        }
