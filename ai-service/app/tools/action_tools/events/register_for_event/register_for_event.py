from __future__ import annotations

from app.core.exceptions import ToolExecutionError
from app.models.chat import ChatRequest
from app.services.backend_client import BackendClient
from app.tools.action_tools.events.shared import resolve_event_target
from app.tools.common import AppTool


class RegisterForEventTool(AppTool):
    name = "register_for_event"
    description = (
        "Register the logged-in user for a specific ParamSukh event after the user explicitly asks to proceed. "
        "For paid events, create a payment link instead of claiming the registration is complete. "
        "If the user refers to follow-up phrases like this event, the cheaper one, the weekend one, "
        "or the Rishikesh one, infer the target from recent event context."
    )
    parameters = {
        "type": "object",
        "properties": {
            "event_id": {
                "type": "string",
                "description": "The event id from a previous event search result when available.",
            },
            "event_title": {
                "type": "string",
                "description": "The event title when the user refers to a specific event by name or says 'this event'.",
            },
            "user_confirmed": {
                "type": "boolean",
                "description": (
                    "True only when the user clearly confirmed they want the assistant to register them for this event."
                ),
            },
            "name": {
                "type": "string",
                "description": "Optional participant name override if the user provided one.",
            },
            "email": {
                "type": "string",
                "description": "Optional participant email override if the user provided one.",
            },
            "phone": {
                "type": "string",
                "description": "Optional participant phone override if the user provided one.",
            },
            "notes": {
                "type": "string",
                "description": "Optional note or instruction to attach to the registration.",
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

    def _build_profile_snapshot(self, arguments: dict[str, object], payload: ChatRequest) -> dict[str, str | None]:
        return {
            "name": str(arguments.get("name", "")).strip() or payload.user.display_name,
            "email": str(arguments.get("email", "")).strip() or None,
            "phone": str(arguments.get("phone", "")).strip() or payload.user.phone,
            "notes": str(arguments.get("notes", "")).strip() or None,
        }

    async def execute(self, arguments: dict[str, object], payload: ChatRequest) -> dict[str, object]:
        auth_token = self.require_auth_token(payload)
        event_id = str(arguments.get("event_id", "")).strip() or None
        event_title = str(arguments.get("event_title", "")).strip() or None
        user_confirmed = bool(arguments.get("user_confirmed", False))

        if not user_confirmed:
            raise self.tool_error("Explicit user confirmation is required before registering for an event.")

        resolved_event_id, resolved_event_title = resolve_event_target(payload, event_id, event_title)
        if not resolved_event_id:
            raise self.tool_error(
                "I could not tell which event you want to register for. Please mention the event name once more."
            )

        profile = self._build_profile_snapshot(arguments, payload)
        event_detail = await self.backend_client.get_event_detail(resolved_event_id)
        verified = await self._get_verified_state(auth_token, resolved_event_id)
        current_status = str(verified.get("status") or "").lower()
        payment_status = str(verified.get("payment_status") or "").lower()

        if verified.get("verified") and verified.get("is_registered") and current_status not in {"cancelled", "canceled"}:
            action = "already_registered"
            summary = "The user is already registered for this event."
            if payment_status in {"pending", "initiated", "created"}:
                action = "payment_pending"
                summary = "The registration already exists and is still waiting for payment completion."
            return {
                "success": True,
                "summary": summary,
                "data": {
                    "action": action,
                    "event_id": resolved_event_id,
                    "event_title": resolved_event_title or event_detail.get("title"),
                    "event": event_detail,
                    "status": verified.get("status") or "registered",
                    "payment_status": verified.get("payment_status") or None,
                    "ticket_id": verified.get("ticket_id"),
                    "message": summary,
                    "verified": True,
                },
            }

        if not event_detail.get("can_register"):
            action = "registration_full" if event_detail.get("is_full") else "registration_closed"
            summary = (
                "This event is currently full, so registration cannot be completed right now."
                if action == "registration_full"
                else "Registration for this event is currently closed."
            )
            return {
                "success": True,
                "summary": summary,
                "data": {
                    "action": action,
                    "event_id": resolved_event_id,
                    "event_title": resolved_event_title or event_detail.get("title"),
                    "event": event_detail,
                    "status": "closed",
                    "message": summary,
                },
            }

        missing_fields: list[str] = []
        if not profile.get("name"):
            missing_fields.append("full name")
        if not profile.get("phone"):
            missing_fields.append("phone number")
        if missing_fields:
            return {
                "success": True,
                "summary": "I need a couple of details before I can finish the event registration.",
                "data": {
                    "action": "missing_profile_info",
                    "event_id": resolved_event_id,
                    "event_title": resolved_event_title or event_detail.get("title"),
                    "event": event_detail,
                    "status": "blocked",
                    "missing_fields": missing_fields,
                    "message": f"Please share your {' and '.join(missing_fields)} to continue.",
                },
            }

        try:
            payment_link = await self.backend_client.create_event_registration_link(
                auth_token,
                resolved_event_id,
                name=profile.get("name"),
                email=profile.get("email"),
                phone=profile.get("phone"),
                notes=profile.get("notes"),
            )
            verified = await self._get_verified_state(auth_token, resolved_event_id)
            if not verified.get("verified"):
                return {
                    "success": True,
                    "summary": "I started the paid event registration, but I could not verify the pending status yet.",
                    "data": {
                        "action": "registration_pending_verification",
                        "event_id": resolved_event_id,
                        "event_title": resolved_event_title or event_detail.get("title"),
                        "event": event_detail,
                        "payment_required": True,
                        "status": "verification_pending",
                        "payment_status": "pending",
                        "message": str(verified.get("verification_error") or "").strip()
                        or "I started the payment flow, but I could not confirm the registration status yet.",
                        "verified": False,
                        **payment_link,
                    },
                }
            if not verified.get("is_registered"):
                raise self.tool_error("I could not verify the pending event registration right now. Please try again.")
            return {
                "success": True,
                "summary": "Created a payment link for the paid event registration.",
                "data": {
                    "action": "payment_link_created",
                    "event_id": resolved_event_id,
                    "event_title": resolved_event_title or event_detail.get("title"),
                    "event": event_detail,
                    "payment_required": True,
                    "status": str(verified.get("status") or "pending"),
                    "payment_status": str(verified.get("payment_status") or "pending"),
                    "verified": True,
                    **payment_link,
                },
            }
        except ToolExecutionError as exc:
            if "Use free registration for this event" not in str(exc):
                raise

        registration = await self.backend_client.register_for_event(
            auth_token,
            resolved_event_id,
            name=profile.get("name"),
            email=profile.get("email"),
            phone=profile.get("phone"),
            notes=profile.get("notes"),
        )
        verified = await self._get_verified_state(auth_token, resolved_event_id)
        if not verified.get("verified"):
            return {
                "success": True,
                "summary": "I submitted the event registration, but I could not verify the final status yet.",
                "data": {
                    "action": "registration_pending_verification",
                    "event_id": resolved_event_id,
                    "event_title": resolved_event_title or event_detail.get("title"),
                    "event": event_detail,
                    "verified": False,
                    "status": registration.get("status") or "verification_pending",
                    "payment_status": registration.get("payment_status"),
                    "message": str(verified.get("verification_error") or "").strip()
                    or "I submitted the registration, but I could not confirm the final status yet.",
                    **registration,
                },
            }
        if not verified.get("is_registered"):
            raise self.tool_error("I could not verify that the event registration completed correctly. Please try again.")

        action = "registered"
        summary = registration.get("message") or "Registered the user for the event."
        if verified.get("status") == "confirmed" and "already registered" in summary.lower():
            action = "already_registered"

        return {
            "success": True,
            "summary": summary,
            "data": {
                "action": action,
                "event_id": resolved_event_id,
                "event_title": resolved_event_title or event_detail.get("title"),
                "event": event_detail,
                "verified": True,
                "status": verified.get("status") or registration.get("status"),
                "payment_status": verified.get("payment_status") or registration.get("payment_status"),
                "ticket_id": verified.get("ticket_id"),
                **registration,
            },
        }
