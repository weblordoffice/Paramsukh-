from __future__ import annotations

from app.core.exceptions import ToolExecutionError
from app.models.chat import ChatRequest
from app.services.backend_client import BackendClient
from app.tools.action_tools.community.shared import resolve_post_target
from app.tools.common import AppTool


class LikeCommunityPostTool(AppTool):
    name = "like_community_post"
    description = (
        "Like or unlike a community post for the logged-in user. "
        "Use this when the user asks to like, unlike, heart, or remove their like from a post."
    )
    parameters = {
        "type": "object",
        "properties": {
            "post_id": {
                "type": "string",
                "description": "Optional post ID when the target post is already known.",
            },
            "post_content": {
                "type": "string",
                "description": "Optional post text reference when the user points to a recent post by content.",
            },
            "desired_state": {
                "type": "string",
                "enum": ["liked", "unliked", "toggle"],
                "description": "The intended final like state for the post.",
            },
        },
        "additionalProperties": False,
    }

    def __init__(self) -> None:
        self.backend_client = BackendClient()

    def _resolve_desired_state(self, arguments: dict[str, object], payload: ChatRequest) -> str:
        explicit = str(arguments.get("desired_state", "")).strip().lower()
        if explicit in {"liked", "unliked", "toggle"}:
            return explicit

        normalized = " ".join(str(payload.message or "").lower().split())
        if any(phrase in normalized for phrase in ("unlike", "remove like", "undo like")):
            return "unliked"
        if "like" in normalized or "heart" in normalized or "love" in normalized:
            return "liked"
        return "toggle"

    async def execute(self, arguments: dict[str, object], payload: ChatRequest) -> dict[str, object]:
        try:
            auth_token = self.require_auth_token(payload)
            desired_state = self._resolve_desired_state(arguments, payload)

            target_post = resolve_post_target(
                payload=payload,
                post_id=str(arguments.get("post_id", "")).strip() or None,
                post_content=str(arguments.get("post_content", "")).strip() or None,
            )
            if not target_post:
                return {
                    "success": True,
                    "summary": "I could not tell which post you wanted to update.",
                    "data": {
                        "action": "post_selection_required",
                        "status": "selection_required",
                        "message": "Please tell me which post you want to like or unlike, or tap the like button on the post card.",
                        "follow_up": "Once the post is clear, I can update the like state for you.",
                    },
                }

            post_id = str(target_post.get("_id") or target_post.get("id") or "").strip()
            post_content = str(target_post.get("content") or "").strip()
            current_state = target_post.get("userLiked")
            if desired_state == "liked" and current_state is True:
                return {
                    "success": True,
                    "summary": "You have already liked this post.",
                    "data": {
                        "action": "already_liked",
                        "status": "already_liked",
                        "post_id": post_id,
                        "post_content": post_content,
                        "user_liked": True,
                        "like_count": target_post.get("likeCount"),
                        "message": "This post is already in your liked state.",
                        "follow_up": "If you want, I can also open the comments or help you reply to the post.",
                    },
                }
            if desired_state == "unliked" and current_state is False:
                return {
                    "success": True,
                    "summary": "This post is already not liked.",
                    "data": {
                        "action": "already_unliked",
                        "status": "already_unliked",
                        "post_id": post_id,
                        "post_content": post_content,
                        "user_liked": False,
                        "like_count": target_post.get("likeCount"),
                        "message": "Your like had already been removed from this post.",
                        "follow_up": "If you want, I can also open the comments or help you reply to the post.",
                    },
                }

            result = await self.backend_client.toggle_post_like(auth_token, post_id)
            final_liked = bool(result.get("liked"))
            final_count = result.get("likeCount")

            if desired_state == "liked" and not final_liked:
                result = await self.backend_client.toggle_post_like(auth_token, post_id)
                final_liked = bool(result.get("liked"))
                final_count = result.get("likeCount")
            elif desired_state == "unliked" and final_liked:
                result = await self.backend_client.toggle_post_like(auth_token, post_id)
                final_liked = bool(result.get("liked"))
                final_count = result.get("likeCount")

            if desired_state == "liked" and not final_liked:
                return {
                    "success": True,
                    "summary": "I tried to like the post, but I could not confirm the final like state.",
                    "data": {
                        "action": "like_state_needs_attention",
                        "status": "needs_attention",
                        "post_id": post_id,
                        "post_content": post_content,
                        "user_liked": final_liked,
                        "like_count": final_count,
                        "message": "I could not safely confirm that the post ended in the liked state. Please try again once.",
                        "follow_up": "If you want, I can also reopen the post thread before you try again.",
                    },
                }
            if desired_state == "unliked" and final_liked:
                return {
                    "success": True,
                    "summary": "I tried to remove the like, but I could not confirm the final state.",
                    "data": {
                        "action": "like_state_needs_attention",
                        "status": "needs_attention",
                        "post_id": post_id,
                        "post_content": post_content,
                        "user_liked": final_liked,
                        "like_count": final_count,
                        "message": "I could not safely confirm that the post ended in the unliked state. Please try again once.",
                        "follow_up": "If you want, I can also reopen the post thread before you try again.",
                    },
                }

            action = "post_liked" if final_liked else "post_unliked"
            summary = "The post is now liked." if final_liked else "The like has been removed from the post."
            return {
                "success": True,
                "summary": summary,
                "data": {
                    "action": action,
                    "status": "liked" if final_liked else "unliked",
                    "post_id": post_id,
                    "post_content": post_content,
                    "user_liked": final_liked,
                    "like_count": final_count,
                    "message": summary,
                    "follow_up": "If you want, I can also open the comments or help you reply to this post.",
                },
            }
        except ToolExecutionError as exc:
            raise self.tool_error(str(exc))
        except Exception:
            raise self.tool_error("I could not update the post like right now. Please try again in a moment.")
