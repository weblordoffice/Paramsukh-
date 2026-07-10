from __future__ import annotations

from app.core.exceptions import ToolExecutionError
from app.models.chat import ChatRequest
from app.services.backend_client import BackendClient
from app.tools.action_tools.community.shared import (
    extract_recent_action_draft,
    extract_tags_from_content,
    normalize_tags,
    resolve_group_target,
)
from app.tools.common import AppTool


class CreateCommunityPostTool(AppTool):
    name = "create_community_post"
    description = (
        "Publish a new community post inside one of the user's community groups. "
        "Use this when the user wants to share an update, ask a question in a group, "
        "or post a message to a community discussion space."
    )
    parameters = {
        "type": "object",
        "properties": {
            "group_id": {
                "type": "string",
                "description": "Optional group ID when the target community is already known.",
            },
            "group_name": {
                "type": "string",
                "description": "Optional group name when the user refers to the community by title.",
            },
            "content": {
                "type": "string",
                "description": "The exact text content to publish as the community post.",
            },
            "tags": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Optional tags to attach to the post.",
            },
            "user_confirmed": {
                "type": "boolean",
                "description": "True only when the user clearly confirmed they want this post to be published.",
            },
        },
        "required": ["user_confirmed"],
        "additionalProperties": False,
    }

    def __init__(self) -> None:
        self.backend_client = BackendClient()

    async def execute(self, arguments: dict[str, object], payload: ChatRequest) -> dict[str, object]:
        try:
            auth_token = self.require_auth_token(payload)
            user_confirmed = bool(arguments.get("user_confirmed", False))
            draft = extract_recent_action_draft(payload, self.name) or {}

            requested_group_id = str(arguments.get("group_id", "")).strip() or str(draft.get("group_id") or "").strip() or None
            requested_group_name = str(arguments.get("group_name", "")).strip() or str(draft.get("group_name") or "").strip() or None
            content = str(arguments.get("content", "")).strip() or str(draft.get("content") or "").strip()
            tags = normalize_tags(arguments.get("tags")) or normalize_tags(draft.get("tags")) or extract_tags_from_content(content)

            if not content:
                return {
                    "success": True,
                    "summary": "I need the post content before I can prepare the community post.",
                    "data": {
                        "action": "missing_content",
                        "status": "blocked",
                        "message": "Please tell me the exact message you want to publish in the community.",
                        "follow_up": "Once you share the message, I can prepare the post for you.",
                    },
                }

            group = await resolve_group_target(
                payload=payload,
                backend_client=self.backend_client,
                auth_token=auth_token,
                group_id=requested_group_id,
                group_name=requested_group_name,
            )
            if not group:
                return {
                    "success": True,
                    "summary": "I need to know which community group should receive this post.",
                    "data": {
                        "action": "group_selection_required",
                        "status": "selection_required",
                        "content": content,
                        "tags": tags,
                        "message": "Please tell me the community group name, or open the group feed first so I can post in the right place.",
                        "follow_up": "Once the group is clear, I can prepare the post immediately.",
                    },
                }

            group_id = str(group.get("_id") or group.get("id") or "").strip()
            group_name = str(group.get("name") or group.get("title") or requested_group_name or "Selected community").strip()

            if not user_confirmed:
                return {
                    "success": True,
                    "summary": f"Ready to publish this post in {group_name}.",
                    "data": {
                        "action": "confirmation_required",
                        "status": "confirmation_required",
                        "group_id": group_id,
                        "group_name": group_name,
                        "content": content,
                        "tags": tags,
                        "message": f"I have prepared your community post for {group_name}. Confirm when you want me to publish it.",
                        "follow_up": "If you want, I can also refine the wording before posting it.",
                    },
                }

            post_response = await self.backend_client.create_post(auth_token, group_id, content, tags or None)
            created_post = post_response.get("post") if isinstance(post_response.get("post"), dict) else post_response
            created_post_id = str(created_post.get("_id") or created_post.get("id") or "").strip()

            verified = False
            try:
                latest_posts = await self.backend_client.get_group_posts(auth_token, group_id, 1)
                verified = any(
                    str(item.get("_id") or item.get("id") or "").strip() == created_post_id
                    for item in latest_posts.get("posts", [])
                    if isinstance(item, dict)
                )
            except Exception:
                verified = False

            summary = (
                f"Your post is now live in {group_name}."
                if verified or created_post_id
                else f"I submitted your post to {group_name}, but I could not verify it yet."
            )
            return {
                "success": True,
                "summary": summary,
                "data": {
                    "action": "post_created" if verified or created_post_id else "post_pending_verification",
                    "status": "published" if verified or created_post_id else "verification_pending",
                    "verified": verified,
                    "group_id": group_id,
                    "group_name": group_name,
                    "content": content,
                    "tags": tags,
                    "post_id": created_post_id or None,
                    "post": created_post,
                    "message": summary,
                    "follow_up": "If you want, I can also open the group feed, add a comment, or help you write another post.",
                },
            }
        except ToolExecutionError as exc:
            raise self.tool_error(str(exc))
        except Exception:
            raise self.tool_error("I could not publish the community post right now. Please try again in a moment.")
