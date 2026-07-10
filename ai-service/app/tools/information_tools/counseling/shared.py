"""
Shared base class and helpers for counseling information tools.
"""
from __future__ import annotations

from app.services.backend_client import BackendClient
from app.tools.common import AppTool


class CounselingInformationTool(AppTool):
    """Base class for all counseling read-only tools."""

    def __init__(self) -> None:
        self.backend_client = BackendClient()


def normalize_service_query(raw: str) -> str:
    """Strip and lowercase a service search query.

    Returns an empty string if the query is too generic to be useful as a filter.
    """
    query = " ".join(raw.lower().strip().split())
    generic_queries = {
        "counseling",
        "counseling services",
        "services",
        "show services",
        "show counseling",
        "show counseling services",
        "what counseling",
        "what services",
        "available services",
        "all services",
        "list services",
        "list counseling services",
        "browse services",
    }
    return "" if query in generic_queries else raw.strip()


def price_label(service: dict) -> str:
    """Return a human-readable price string for a counseling service."""
    if service.get("is_free"):
        return "Free"
    price = service.get("price")
    if price is not None and price > 0:
        return f"₹{int(price)}"
    return "Free"
