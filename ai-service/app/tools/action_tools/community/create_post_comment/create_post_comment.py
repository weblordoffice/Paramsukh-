from __future__ import annotations

from app.core.exceptions import ToolExecutionError
from app.models.chat import ChatRequest
from app.services.backend_client import BackendClient
from app.tools.action_tools.community.shared import extract_recent_action_draft, resolve_post_target
from app.tools.common import AppTool


class CreatePostCommentTool(AppTool):
    name = "create_post_comment"
    description = (
        "Add a reply comment to a community post. "
        "Use this when the user wants to respond to a discussion, answer a post, "
        "or join the comment thread on a community post."
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
                "description": "Optional original post text reference when the user points to a post by content.",
            },
            "content": {
                "type": "string",
                "description": "The reply text to publish as a comment.",
            },
            "user_confirmed": {
                "type": "boolean",
                "description": "True only when the user clearly confirmed they want this reply to be posted.",
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

            requested_post_id = str(arguments.get("post_id", "")).strip() or str(draft.get("post_id") or "").strip() or None
            requested_post_content = (
                str(arguments.get("post_content", "")).strip()
                or str(draft.get("post_content") or "").strip()
                or None
            )
            content = str(arguments.get("content", "")).strip() or str(draft.get("content") or "").strip()

            if not content:
                return {
                    "success": True,
                    "summary": "I need the reply text before I can prepare the comment.",
                    "data": {
                        "action": "missing_content",
                        "status": "blocked",
                        "message": "Please tell me the exact reply you want to add to this post.",
                        "follow_up": "Once you share the reply text, I can prepare the comment for you.",
                    },
                }

            target_post = resolve_post_target(
                payload=payload,
                post_id=requested_post_id,
                post_content=requested_post_content,
            )
            if not target_post:
                return {
                    "success": True,
                    "summary": "I need to know which post you want to reply to.",
                    "data": {
                        "action": "post_selection_required",
                        "status": "selection_required",
                        "content": content,
                        "message": "Please tell me which post you want to comment on, or open the post comments first.",
                        "follow_up": "Once the post is clear, I can prepare the reply immediately.",
                    },
                }

            post_id = str(target_post.get("_id") or target_post.get("id") or requested_post_id or "").strip()
            post_content = str(target_post.get("content") or requested_post_content or "").strip()

            if not user_confirmed:
                return {
                    "success": True,
                    "summary": "Ready to publish your reply on the selected post.",
                    "data": {
                        "action": "confirmation_required",
                        "status": "confirmation_required",
                        "post_id": post_id,
                        "post_content": post_content,
                        "content": content,
                        "message": "I have prepared your reply comment. Confirm when you want me to publish it.",
                        "follow_up": "If you want, I can also help you refine the reply before posting it.",
                    },
                }

            comment_response = await self.backend_client.create_comment(auth_token, post_id, content)
            created_comment = comment_response.get("comment") if isinstance(comment_response.get("comment"), dict) else comment_response
            created_comment_id = str(created_comment.get("_id") or created_comment.get("id") or "").strip()

            verified = False
            try:
                comments_state = await self.backend_client.get_post_comments(auth_token, post_id)
                verified = any(
                    str(item.get("_id") or item.get("id") or "").strip() == created_comment_id
                    for item in comments_state.get("comments", [])
                    if isinstance(item, dict)
                )
            except Exception:
                verified = False

            summary = (
                "Your reply has been added to the discussion."
                if verified or created_comment_id
                else "I submitted your reply, but I could not verify it in the thread yet."
            )
            return {
                "success": True,
                "summary": summary,
                "data": {
                    "action": "comment_created" if verified or created_comment_id else "comment_pending_verification",
                    "status": "published" if verified or created_comment_id else "verification_pending",
                    "verified": verified,
                    "post_id": post_id,
                    "post_content": post_content,
                    "content": content,
                    "comment_id": created_comment_id or None,
                    "comment": created_comment,
                    "message": summary,
                    "follow_up": "If you want, I can also open the updated comment thread or help you respond to another post.",
                },
            }
        except ToolExecutionError as exc:
            raise self.tool_error(str(exc))
        except Exception:
            raise self.tool_error("I could not publish the reply comment right now. Please try again in a moment.")
