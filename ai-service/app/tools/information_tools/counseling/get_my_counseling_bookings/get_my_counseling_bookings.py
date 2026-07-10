"""
Tool: get_my_counseling_bookings

Fetch the active user's counseling session appointments.
The tool allows filtering by booking status (pending, confirmed, cancelled, completed)
and upcoming slots (date >= today).
"""
from __future__ import annotations

from app.models.chat import ChatRequest
from app.tools.information_tools.counseling.shared import CounselingInformationTool


class GetMyCounselingBookingsTool(CounselingInformationTool):
    name = "get_my_counseling_bookings"
    description = (
        "Retrieve the active user's booked counseling appointments and schedule. "
        "Use this when the user asks 'show my appointments', 'my bookings', 'when is my session', "
        "or wants to view their upcoming counseling status."
    )
    parameters = {
        "type": "object",
        "properties": {
            "status": {
                "type": "string",
                "description": "Optional. Filter by status: 'pending', 'confirmed', 'completed', or 'cancelled'.",
                "enum": ["pending", "confirmed", "completed", "cancelled"],
            },
            "upcoming": {
                "type": "boolean",
                "description": "Optional. If true, only retrieves pending or confirmed sessions for today and future dates.",
            },
        },
        "additionalProperties": False,
    }

    async def execute(
        self,
        arguments: dict[str, object],
        payload: ChatRequest,
    ) -> dict[str, object]:
        status = arguments.get("status")
        upcoming = bool(arguments.get("upcoming", False))
        auth_token = payload.backend_auth_token

        # Fetch bookings from backend
        response = await self.backend_client.get_my_counseling_bookings(
            status=str(status) if status else None,
            upcoming=upcoming,
            auth_token=auth_token,
        )

        bookings = response.get("items") or []
        total = response.get("total") or 0

        # Construct summary
        filter_parts = []
        if status:
            filter_parts.append(f"status '{status}'")
        if upcoming:
            filter_parts.append("upcoming sessions")
        filter_desc = " (" + ", ".join(filter_parts) + ")" if filter_parts else ""

        if total == 0:
            summary = f"You do not have any counseling bookings scheduled{filter_desc}."
        elif total == 1:
            summary = f"I found 1 counseling booking{filter_desc}."
        else:
            summary = f"I found {total} counseling bookings{filter_desc}."

        return {
            "success": True,
            "summary": summary,
            "data": {
                "bookings": bookings,
                "total_bookings": total,
            },
        }
