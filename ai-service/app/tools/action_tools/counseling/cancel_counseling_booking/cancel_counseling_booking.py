"""
Tool: cancel_counseling_booking

Cancel a counseling session booking for the authenticated user.
Refunds the slot back to the clinical calendar (and triggers refund if paid).
"""
from __future__ import annotations

from app.models.chat import ChatRequest
from app.tools.common import AppTool
from app.services.backend_client import BackendClient


class CancelCounselingBookingTool(AppTool):
    name = "cancel_counseling_booking"
    description = (
        "Cancel an upcoming counseling session booking for the user. "
        "Use this when the user explicitly asks to cancel their booking. "
        "Always call with user_confirmed=false first to show the confirmation card UI."
    )
    parameters = {
        "type": "object",
        "properties": {
            "booking_id": {
                "type": "string",
                "description": "The unique ID of the booking to cancel.",
            },
            "reason": {
                "type": "string",
                "description": "Optional reason for cancelling the booking.",
            },
            "user_confirmed": {
                "type": "boolean",
                "description": (
                    "Must be set to True only when the user confirms they want to cancel the booking."
                ),
            },
        },
        "required": ["booking_id", "user_confirmed"],
        "additionalProperties": False,
    }

    def __init__(self) -> None:
        self.backend_client = BackendClient()

    async def execute(
        self,
        arguments: dict[str, object],
        payload: ChatRequest,
    ) -> dict[str, object]:
        booking_id = str(arguments.get("booking_id", "")).strip()
        reason = arguments.get("reason")
        user_confirmed = bool(arguments.get("user_confirmed", False))
        auth_token = payload.backend_auth_token

        if not booking_id:
            return {
                "success": False,
                "summary": "booking_id is required to cancel a booking.",
                "data": {"error": "missing_booking_id"},
            }

        # Retrieve user's bookings to get details of this specific booking
        bookings_response = await self.backend_client.get_my_counseling_bookings(
            auth_token=auth_token
        )
        bookings = bookings_response.get("items") or []
        booking = next((b for b in bookings if b["id"] == booking_id), None)

        if not booking:
            return {
                "success": False,
                "summary": f"Could not find booking with ID '{booking_id}' in your account.",
                "data": {"error": "booking_not_found"},
            }

        counselor_type = booking.get("counselor_type") or "Counseling Session"
        booking_date = booking.get("booking_date")
        booking_time = booking.get("booking_time")
        status = booking.get("status")

        if status == "cancelled":
            return {
                "success": True,
                "summary": f"This counseling session ({counselor_type}) has already been cancelled.",
                "data": {
                    "action": "already_cancelled",
                    "booking_id": booking_id,
                    "counselor_type": counselor_type,
                    "booking_date": booking_date,
                    "booking_time": booking_time,
                    "status": "cancelled",
                },
            }

        # Format date for human readability
        formatted_date = booking_date
        try:
            # Parse ISO date string if possible
            parsed_dt = __import__("datetime").datetime.fromisoformat(booking_date.replace("Z", "+00:00"))
            formatted_date = parsed_dt.strftime("%d %B %Y")
        except Exception:
            pass

        # Step 1: Confirmation Required (Render Confirmation Card)
        if not user_confirmed:
            summary = (
                f"Are you sure you want to cancel your counseling session for {counselor_type} "
                f"scheduled on {formatted_date} at {booking_time}?"
            )
            return {
                "success": True,
                "summary": summary,
                "data": {
                    "action": "confirmation_required",
                    "booking_id": booking_id,
                    "counselor_type": counselor_type,
                    "booking_date": booking_date,
                    "booking_time": booking_time,
                    "reason": reason,
                    "message": summary,
                },
            }

        # Step 2: User Confirmed - Cancel the Booking
        try:
            cancel_res = await self.backend_client.cancel_counseling_booking(
                booking_id=booking_id,
                reason=str(reason) if reason else None,
                auth_token=auth_token,
            )
        except Exception as exc:
            return {
                "success": False,
                "summary": f"Failed to cancel booking: {str(exc)}",
                "data": {"error": "cancel_failed", "details": str(exc)},
            }

        summary = f"Your counseling session for {counselor_type} on {formatted_date} at {booking_time} has been successfully cancelled."
        return {
            "success": True,
            "summary": summary,
            "data": {
                "action": "booking_cancelled",
                "booking_id": booking_id,
                "counselor_type": counselor_type,
                "booking_date": booking_date,
                "booking_time": booking_time,
                "status": "cancelled",
                "message": summary,
            },
        }
