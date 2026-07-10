"""
Tool: book_counseling_session

Book a counselor session slot for the authenticated user.
Handles both free bookings (which confirm instantly) and paid bookings (which generate
a Razorpay hosted checkout payment link).
"""
from __future__ import annotations

from app.models.chat import ChatRequest
from app.tools.common import AppTool
from app.services.backend_client import BackendClient


class BookCounselingSessionTool(AppTool):
    name = "book_counseling_session"
    description = (
        "Book a counseling session slot for the user. "
        "Use this when the user explicitly confirms they want to book a session. "
        "For paid services, this generates a Razorpay payment link. "
        "Always call with user_confirmed=false first to show the confirmation card UI."
    )
    parameters = {
        "type": "object",
        "properties": {
            "counselor_type": {
                "type": "string",
                "description": (
                    "The counseling service name or title, e.g. 'Spiritual Morning Guidance' "
                    "or 'Mindfulness & Meditation Coaching'."
                ),
            },
            "booking_date": {
                "type": "string",
                "description": "The date of the session in YYYY-MM-DD format.",
            },
            "booking_time": {
                "type": "string",
                "description": "The selected time slot, e.g., '10:00 AM' or '04:30 PM'.",
            },
            "user_notes": {
                "type": "string",
                "description": "Optional notes or questions the user has for the counselor.",
            },
            "user_confirmed": {
                "type": "boolean",
                "description": (
                    "Must be set to True only when the user confirms they want to proceed with the booking."
                ),
            },
        },
        "required": ["counselor_type", "booking_date", "booking_time", "user_confirmed"],
        "additionalProperties": False,
    }

    def __init__(self) -> None:
        self.backend_client = BackendClient()

    async def execute(
        self,
        arguments: dict[str, object],
        payload: ChatRequest,
    ) -> dict[str, object]:
        counselor_type = str(arguments.get("counselor_type", "")).strip()
        booking_date = str(arguments.get("booking_date", "")).strip()
        booking_time = str(arguments.get("booking_time", "")).strip()
        user_notes = arguments.get("user_notes")
        user_confirmed = bool(arguments.get("user_confirmed", False))
        auth_token = payload.backend_auth_token

        if not counselor_type or not booking_date or not booking_time:
            return {
                "success": False,
                "summary": "Counselor type, booking date, and booking time are required.",
                "data": {"error": "missing_required_params"},
            }

        # Resolve details about the counseling service first to get pricing/counselor name
        services_response = await self.backend_client.get_counseling_services()
        services = services_response.get("items") or []
        service = next(
            (s for s in services if s["title"].lower() == counselor_type.lower() or s["id"] == counselor_type),
            None
        )

        if not service:
            return {
                "success": False,
                "summary": f"Could not find counseling service '{counselor_type}'.",
                "data": {"error": "service_not_found"},
            }

        resolved_title = service["title"]
        counselor_name = service.get("counselor_name") or "Expert Counselor"
        price = service.get("price") or 0.0
        is_free = service.get("is_free", True) or price == 0.0

        # Step 1: Confirmation Required (Render Confirmation Card)
        if not user_confirmed:
            summary = (
                f"I have prepared your counseling session details for {resolved_title} "
                f"with {counselor_name} on {booking_date} at {booking_time}. "
                f"Please confirm to proceed."
            )
            return {
                "success": True,
                "summary": summary,
                "data": {
                    "action": "confirmation_required",
                    "counselor_type": resolved_title,
                    "counselor_name": counselor_name,
                    "booking_date": booking_date,
                    "booking_time": booking_time,
                    "user_notes": user_notes,
                    "price": price,
                    "is_free": is_free,
                    "message": summary,
                },
            }

        # Step 2: User Confirmed - Book the Session
        try:
            booking_res = await self.backend_client.book_counseling_session(
                counselor_type=resolved_title,
                booking_date=booking_date,
                booking_time=booking_time,
                user_notes=str(user_notes) if user_notes else None,
                auth_token=auth_token,
            )
        except Exception as exc:
            return {
                "success": False,
                "summary": f"Failed to book counseling session: {str(exc)}",
                "data": {"error": "booking_failed", "details": str(exc)},
            }

        booking = booking_res.get("booking") or {}
        booking_id = booking.get("id")

        if not booking_id:
            return {
                "success": False,
                "summary": "Failed to retrieve booking reference after creation.",
                "data": {"error": "missing_booking_id"},
            }

        # Step 3: Handle Payment Link for Paid Services
        if not is_free:
            try:
                payment_link = await self.backend_client.create_booking_payment_link(
                    booking_id=booking_id,
                    auth_token=auth_token,
                )
                summary = f"I've initialized your booking for {resolved_title}. Please complete the payment to confirm your session."
                return {
                    "success": True,
                    "summary": summary,
                    "data": {
                        "action": "payment_link_created",
                        "booking_id": booking_id,
                        "counselor_type": resolved_title,
                        "booking_date": booking_date,
                        "booking_time": booking_time,
                        "payment_required": True,
                        "status": "pending",
                        "payment_status": "pending",
                        "payment_url": payment_link.get("url"),
                        "payment_link_id": payment_link.get("payment_link_id"),
                        "amount": price,
                        "message": summary,
                    },
                }
            except Exception as exc:
                return {
                    "success": True,
                    "summary": f"Your session is booked, but we could not generate the payment link: {str(exc)}",
                    "data": {
                        "action": "booking_pending_payment",
                        "booking_id": booking_id,
                        "counselor_type": resolved_title,
                        "booking_date": booking_date,
                        "booking_time": booking_time,
                        "status": "pending",
                        "payment_status": "pending",
                        "payment_error": str(exc),
                    },
                }

        # Step 4: Free Booking Confirmed Instantly
        summary = f"Your counseling session for {resolved_title} on {booking_date} at {booking_time} has been successfully booked and confirmed!"
        return {
            "success": True,
            "summary": summary,
            "data": {
                "action": "booking_confirmed",
                "booking_id": booking_id,
                "counselor_type": resolved_title,
                "booking_date": booking_date,
                "booking_time": booking_time,
                "status": "confirmed",
                "payment_status": "not_required",
                "message": summary,
            },
        }
