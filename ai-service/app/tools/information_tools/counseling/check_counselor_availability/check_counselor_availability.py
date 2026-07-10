"""
Tool: check_counselor_availability

Retrieve available booking time slots for a counseling service on a specific date.
The user can optionally specify a service type (e.g. "Spiritual Morning Guidance") to
scope the lookup to a particular counselor's schedule. If no counselor type is given,
the backend returns slots for the "general" counselor calendar.

This is a read-only informative tool; it does NOT create any booking.
"""
from __future__ import annotations

import re
from datetime import date, datetime, timezone

from app.models.chat import ChatRequest
from app.tools.information_tools.counseling.shared import CounselingInformationTool

# ─── Date helpers ────────────────────────────────────────────────────────────

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _is_valid_date(value: str) -> bool:
    """Return True if *value* is a valid YYYY-MM-DD date string that is not in the past."""
    if not _DATE_RE.match(value):
        return False
    try:
        parsed = datetime.strptime(value, "%Y-%m-%d").replace(tzinfo=timezone.utc).date()
    except ValueError:
        return False
    return parsed >= date.today()


def _human_date(value: str) -> str:
    """Format YYYY-MM-DD as a human-friendly string, e.g. '12 July 2025'."""
    try:
        return datetime.strptime(value, "%Y-%m-%d").strftime("%-d %B %Y")
    except (ValueError, AttributeError):
        # Windows does not support %-d; fall back to %d
        try:
            return datetime.strptime(value, "%Y-%m-%d").strftime("%d %B %Y").lstrip("0") or value
        except ValueError:
            return value


# ─── Tool ────────────────────────────────────────────────────────────────────


class CheckCounselorAvailabilityTool(CounselingInformationTool):
    name = "check_counselor_availability"
    description = (
        "Retrieve available time slots for a counseling service on a specific date. "
        "Use this when the user asks about free slots, available times, 'when can I book', "
        "'is there availability this week', or wants to see when a specific counselor is free. "
        "Requires a date; optionally a counselor or service name to narrow the lookup."
    )
    parameters = {
        "type": "object",
        "properties": {
            "date": {
                "type": "string",
                "description": (
                    "The date to check for slot availability, in YYYY-MM-DD format. "
                    "Must be today or a future date. Example: '2025-07-10'."
                ),
            },
            "counselor_type": {
                "type": "string",
                "description": (
                    "Optional. The counseling service title or type to check availability for, "
                    "e.g. 'Spiritual Morning Guidance' or 'Mindfulness & Meditation Coaching'. "
                    "Leave empty to check general availability across all services."
                ),
            },
        },
        "required": ["date"],
        "additionalProperties": False,
    }

    async def execute(
        self,
        arguments: dict[str, object],
        payload: ChatRequest,
    ) -> dict[str, object]:
        # ── Input extraction & validation ───────────────────────────────────
        raw_date = str(arguments.get("date", "") or "").strip()
        counselor_type = str(arguments.get("counselor_type", "") or "").strip() or None

        # If no date was provided, default to tomorrow
        if not raw_date:
            raw_date = (date.today() + __import__("datetime").timedelta(days=1)).isoformat()

        if not _is_valid_date(raw_date):
            return {
                "success": False,
                "summary": (
                    f"'{raw_date}' is not a valid future date. "
                    "Please use the format YYYY-MM-DD and choose today or a future date."
                ),
                "data": {
                    "error": "invalid_date",
                    "date": raw_date,
                    "slots": [],
                    "total_slots": 0,
                },
            }

        # ── Backend fetch ───────────────────────────────────────────────────
        availability = await self.backend_client.get_counselor_availability(
            date=raw_date,
            counselor_type=counselor_type,
        )

        slots: list[str] = availability.get("slots") or []
        total: int = availability.get("total_slots") or 0
        display_date = _human_date(raw_date)

        # ── Summary generation ──────────────────────────────────────────────
        service_label = counselor_type or "all counseling services"

        if total == 0:
            summary = (
                f"No available slots were found for {service_label} on {display_date}. "
                "Try a different date or service."
            )
        elif total == 1:
            summary = (
                f"There is 1 available slot for {service_label} on {display_date}: {slots[0]}."
            )
        else:
            summary = (
                f"There are {total} available slots for {service_label} on {display_date}."
            )

        return {
            "success": True,
            "summary": summary,
            "data": {
                "date": raw_date,
                "display_date": display_date,
                "counselor_type": counselor_type,
                "slots": slots,
                "total_slots": total,
                "is_fully_booked": total == 0,
            },
        }
