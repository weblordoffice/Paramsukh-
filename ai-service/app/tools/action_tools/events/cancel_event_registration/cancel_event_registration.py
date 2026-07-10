from __future__ import annotations

from app.core.exceptions import ToolExecutionError
from app.models.chat import ChatRequest
from app.services.backend_client import BackendClient
from app.tools.action_tools.events.shared import resolve_event_target
from app.tools.common import AppTool


class CancelEventRegistrationTool(AppTool):
    name = "cancel_event_registration"
    description = (
        "Cancel the logged-in user's registration for a specific ParamSukh event after the user explicitly confirms they want to cancel it. "
        "If the user refers to a recent result with phrases like this event, the weekend one, or the Rishikesh one, infer the target from recent event context."
    )
    parameters = {
        "type": "object",
        "properties": {
            "event_id": {
                "type": "string",
                "description": "The event id from a previous event or registration tool result when available.",
            },
            "event_title": {
                "type": "string",
                "description": "The event title when the user refers to a specific event by name or says 'this event'.",
            },
            "user_confirmed": {
                "type": "boolean",
                "description": (
                    "True only when the user clearly confirmed they want the assistant to cancel their event registration."
                ),
            },
        },
        "required": ["user_confirmed"],
        "additionalProperties": False,
    }

    def __init__(self) -> None:
        self.backend_client = BackendClient()

    async def _get_verified_state(self, auth_token: str, event_id: str) -> dict[str, object]:
        try:
            verified = await self.backend_client.get_event_registration_status(auth_token, event_id)
            verified["verified"] = True
            return verified
        except ToolExecutionError as exc:
            return {
                "verified": False,
                "verification_error": str(exc).strip() or "Could not verify the event registration state.",
            }

    async def execute(self, arguments: dict[str, object], payload: ChatRequest) -> dict[str, object]:
        auth_token = self.require_auth_token(payload)
        event_id = str(arguments.get("event_id", "")).strip() or None
        event_title = str(arguments.get("event_title", "")).strip() or None
        user_confirmed = bool(arguments.get("user_confirmed", False))

        if not user_confirmed:
            raise self.tool_error("I need your confirmation before cancelling an event registration.")

        resolved_event_id, resolved_event_title = resolve_event_target(payload, event_id, event_title)
        if not resolved_event_id:
            raise self.tool_error(
                "I could not tell which event registration you want to cancel. Please mention the event name once more."
            )

        event_detail = await self.backend_client.get_event_detail(resolved_event_id)
        verified_before = await self._get_verified_state(auth_token, resolved_event_id)
        if verified_before.get("verified"):
            status_before = str(verified_before.get("status") or "").lower()
            if not verified_before.get("is_registered") or status_before in {"cancelled", "canceled"}:
                return {
                    "success": True,
                    "summary": "The user does not have an active registration for that event.",
                    "data": {
                        "action": "registration_not_found",
                        "event_id": resolved_event_id,
                        "event_title": resolved_event_title or event_detail.get("title"),
                        "event": event_detail,
                        "status": "not_found",
                        "message": "I could not find an active registration for that event.",
                    },
                }

        try:
            cancellation = await self.backend_client.cancel_event_registration(auth_token, resolved_event_id)
            verified = await self._get_verified_state(auth_token, resolved_event_id)
            cancellation_message = str(cancellation.get("message") or "").strip()
            if "already cancelled" in cancellation_message.lower():
                return {
                    "success": True,
                    "summary": "That registration was already cancelled.",
                    "data": {
                        "action": "registration_already_cancelled",
                        "event_id": resolved_event_id,
                        "event_title": resolved_event_title or event_detail.get("title"),
                        "event": event_detail,
                        "status": "cancelled",
                        "message": cancellation_message,
                        "verified": True,
                    },
                }
            if not verified.get("verified"):
                return {
                    "success": True,
                    "summary": "I sent the cancellation request, but I could not verify the final status yet.",
                    "data": {
                        "action": "cancellation_pending_verification",
                        "event_id": resolved_event_id,
                        "event_title": resolved_event_title or event_detail.get("title"),
                        "event": event_detail,
                        "status": "verification_pending",
                        "message": str(verified.get("verification_error") or "").strip()
                        or "I sent the cancellation request, but I could not confirm the final status yet.",
                        "verified": False,
                    },
                }
            if verified.get("is_registered"):
                return {
                    "success": True,
                    "summary": "The event registration still appears active after the cancellation attempt.",
                    "data": {
                        "action": "cancellation_needs_attention",
                        "event_id": resolved_event_id,
                        "event_title": resolved_event_title or event_detail.get("title"),
                        "event": event_detail,
                        "status": str(verified.get("status") or "unknown"),
                        "message": "I tried to cancel that registration, but it still appears active. Please try once more.",
                    },
                }
        except ToolExecutionError as exc:
            message = str(exc).strip() or "I could not cancel that event registration right now."
            lowered = message.lower()
            if "not found" in lowered:
                return {
                    "success": True,
                    "summary": "The user does not have an active registration for that event.",
                    "data": {
                        "action": "registration_not_found",
                        "event_id": resolved_event_id,
                        "event_title": resolved_event_title or event_detail.get("title"),
                        "event": event_detail,
                        "status": "not_found",
                        "message": "I could not find an active registration for that event.",
                    },
                }
            return {
                "success": True,
                "summary": "The event registration could not be cancelled right now.",
                "data": {
                    "action": "cancellation_unavailable",
                    "event_id": resolved_event_id,
                    "event_title": resolved_event_title or event_detail.get("title"),
                    "event": event_detail,
                    "status": "failed",
                    "message": "I could not cancel that event registration right now. Please try again shortly.",
                },
            }

        return {
            "success": True,
            "summary": cancellation.get("message") or "Cancelled the event registration.",
            "data": {
                "action": "registration_cancelled",
                "event_id": resolved_event_id,
                "event_title": resolved_event_title or event_detail.get("title"),
                "event": event_detail,
                "verified": True,
                **cancellation,
            },
        }
