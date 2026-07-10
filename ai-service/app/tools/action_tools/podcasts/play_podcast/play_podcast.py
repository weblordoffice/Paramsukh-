from __future__ import annotations

from app.models.chat import ChatRequest
from app.tools.common import AppTool
from app.services.backend_client import BackendClient


class PlayPodcastTool(AppTool):
    name = "play_podcast"
    description = (
        "Play or stream a specific spiritual podcast, mantra, or mindfulness audio. "
        "Use this when the user explicitly requests to listen to or play a specific podcast. "
        "Always call with user_confirmed=false first to show the playback confirmation card UI."
    )
    parameters = {
        "type": "object",
        "properties": {
            "title": {
                "type": "string",
                "description": "The title or keywords of the podcast/audio track to play.",
            },
            "user_confirmed": {
                "type": "boolean",
                "description": "Must be set to True only when the user confirms they want to play the podcast.",
            },
        },
        "required": ["title", "user_confirmed"],
        "additionalProperties": False,
    }

    def __init__(self) -> None:
        self.backend_client = BackendClient()

    async def execute(
        self,
        arguments: dict[str, object],
        payload: ChatRequest,
    ) -> dict[str, object]:
        search_title = str(arguments.get("title", "")).strip().lower()
        user_confirmed = bool(arguments.get("user_confirmed", False))
        auth_token = payload.backend_auth_token

        if not search_title:
            return {
                "success": False,
                "summary": "Please specify the title of the podcast you'd like to play.",
                "data": {"error": "missing_title"},
            }

        # 1. Fetch available podcasts list (user-accessible if auth token is present, otherwise public)
        try:
            if auth_token:
                res = await self.backend_client.get_user_accessible_podcasts(auth_token)
            else:
                res = await self.backend_client.get_public_podcasts()
        except Exception as exc:
            return {
                "success": False,
                "summary": f"Failed to retrieve podcasts: {str(exc)}",
                "data": {"error": "fetch_failed", "details": str(exc)},
            }

        podcasts = res.get("items") or []

        # 2. Match requested podcast by title
        matched_podcast = None
        for p in podcasts:
            title = str(p.get("title", "")).lower()
            if search_title in title or title in search_title:
                matched_podcast = p
                break

        if not matched_podcast:
            return {
                "success": False,
                "summary": f"I couldn't find any podcast matching '{arguments.get('title')}' in the library.",
                "data": {"error": "podcast_not_found"},
            }

        podcast_title = matched_podcast.get("title") or "Selected Podcast"
        access_type = matched_podcast.get("access_type") or "free"

        # 3. Check access permission
        can_access = matched_podcast.get("can_access")
        if can_access is None:
            # Fallback for public / unauthenticated list
            can_access = (access_type == "free")

        # 4. Resolve play flow states
        if can_access:
            if not user_confirmed:
                summary = f"Would you like to play the podcast '{podcast_title}' hosted by {matched_podcast.get('host', 'Expert')}?"
                return {
                    "success": True,
                    "summary": summary,
                    "data": {
                        "action": "confirmation_required",
                        "podcast_id": matched_podcast.get("id"),
                        "counselor_type": podcast_title, # mapped for presentation row compatibility
                        "booking_date": matched_podcast.get("host", "ParamSukh Host"),
                        "booking_time": matched_podcast.get("duration", "N/A"),
                        "podcast": matched_podcast,
                        "message": summary,
                    },
                }
            else:
                summary = f"I've prepared the playback for '{podcast_title}'. Enjoy the spiritual session!"
                return {
                    "success": True,
                    "summary": summary,
                    "data": {
                        "action": "play_confirmed",
                        "podcast_id": matched_podcast.get("id"),
                        "podcast": matched_podcast,
                        "message": summary,
                    },
                }

        # 5. Blocked access handling
        if access_type == "membership":
            summary = f"The podcast '{podcast_title}' is premium content. You need to upgrade your membership plan to unlock it."
            return {
                "success": True,
                "summary": summary,
                "data": {
                    "action": "membership_required",
                    "podcast_id": matched_podcast.get("id"),
                    "podcast": matched_podcast,
                    "message": summary,
                },
            }

        elif access_type == "paid":
            summary = f"The podcast '{podcast_title}' is premium paid content. You need to purchase this track to unlock playback."
            return {
                "success": True,
                "summary": summary,
                "data": {
                    "action": "payment_required",
                    "podcast_id": matched_podcast.get("id"),
                    "podcast": matched_podcast,
                    "message": summary,
                },
            }

        # Catch-all
        return {
            "success": False,
            "summary": "You do not have permission to play this podcast.",
            "data": {"error": "access_denied", "podcast": matched_podcast},
        }
