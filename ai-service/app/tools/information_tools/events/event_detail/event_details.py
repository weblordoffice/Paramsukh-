from __future__ import annotations

from app.core.exceptions import ToolExecutionError
from app.models.chat import ChatRequest
from app.services.backend_client import BackendClient
from app.tools.common import AppTool
from app.tools.information_tools.events.shared import resolve_single_event_reference


class GetEventDetailsTool(AppTool):
    name = "get_event_details"
    description = (
        "Get detailed information about a specific ParamSukh event, including timing, preparation notes, "
        "registration availability, and the logged-in user's registration status when available."
    )
    parameters = {
        "type": "object",
        "properties": {
            "event_id": {"type": "string", "description": "Optional event id."},
            "event_title": {"type": "string", "description": "Optional event title."},
            "detail_focus": {
                "type": "string",
                "description": "Optional focus such as timing, preparation, registration_status, or ticket.",
            },
        },
        "required": [],
        "additionalProperties": False,
    }

    def __init__(self) -> None:
        self.backend_client = BackendClient()

    async def execute(self, arguments: dict[str, object], payload: ChatRequest) -> dict[str, object]:
        message_text = str(payload.message or "").strip()
        event_id, _event_title = resolve_single_event_reference(
            payload,
            str(arguments.get("event_id", "")).strip() or None,
            str(arguments.get("event_title", "")).strip() or None,
            message_text,
        )
        if not event_id:
            raise self.tool_error("I could not tell which event you mean. Please mention the event name once more.")

        event = await self.backend_client.get_event_detail(event_id)
        registration = None
        if payload.backend_auth_token:
            try:
                registration = await self.backend_client.get_event_registration_status(payload.backend_auth_token, event_id)
            except ToolExecutionError:
                registration = None

        detail_focus = str(arguments.get("detail_focus", "")).strip() or "general"
        support_rows = [
            {"label": "Date", "value": str(event.get("event_date") or "Not available")},
            {"label": "Time", "value": str(event.get("event_time") or "Not available")},
            {"label": "Location", "value": str(event.get("location") or "Not available")},
            {"label": "Format", "value": str(event.get("location_type") or "Not available")},
            {
                "label": "Price",
                "value": f"{event.get('currency') or 'INR'} {event.get('price')}"
                if event.get("is_paid")
                else "Free",
            },
            {"label": "Registration", "value": "Open" if event.get("can_register") else "Closed"},
        ]
        if registration:
            support_rows.append(
                {
                    "label": "Your Status",
                    "value": str(
                        registration.get("status")
                        or ("registered" if registration.get("is_registered") else "not_registered")
                    ),
                }
            )
            if registration.get("ticket_id"):
                support_rows.append({"label": "Ticket", "value": str(registration.get("ticket_id"))})

        summary = f"Loaded details for '{event.get('title')}'."
        if detail_focus == "ticket" and registration and registration.get("ticket_id"):
            summary = f"Your ticket for '{event.get('title')}' is {registration.get('ticket_id')}."
        elif detail_focus == "registration_status" and registration:
            summary = f"Your registration for '{event.get('title')}' is currently {registration.get('status') or 'not active'}."
        elif detail_focus == "preparation":
            summary = f"Loaded preparation details for '{event.get('title')}'."
        elif detail_focus == "timing":
            summary = f"Loaded timing details for '{event.get('title')}'."

        return {
            "success": True,
            "summary": summary,
            "data": {
                "event": event,
                "registration": registration,
                "detail_focus": detail_focus,
                "rows": support_rows,
            },
        }
