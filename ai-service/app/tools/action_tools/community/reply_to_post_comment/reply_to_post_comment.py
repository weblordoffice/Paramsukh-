from __future__ import annotations

from app.core.exceptions import ToolExecutionError
from app.models.chat import ChatRequest
from app.services.backend_client import BackendClient
from app.tools.action_tools.community.shared import extract_recent_action_draft, resolve_comment_target
from app.tools.common import AppTool


class ReplyToPostCommentTool(AppTool):
    name = "reply_to_post_comment"
    description = (
        "Reply to a specific comment inside a community post thread. "
        "Use this when the user wants to answer a comment, respond to someone's reply, "
        "or continue a specific branch of a discussion."
    )
    parameters = {
        "type": "object",
        "properties": {
            "comment_id": {
                "type": "string",
                "description": "Optional comment ID when the target comment is already known.",
            },
            "comment_content": {
                "type": "string",
                "description": "Optional original comment text reference when the user refers to a recent comment by content.",
            },
            "content": {
                "type": "string",
                "description": "The exact reply text to publish under the target comment.",
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

            requested_comment_id = str(arguments.get("comment_id", "")).strip() or str(draft.get("comment_id") or "").strip() or None
            requested_comment_content = (
                str(arguments.get("comment_content", "")).strip()
                or str(draft.get("comment_content") or "").strip()
                or None
            )
            content = str(arguments.get("content", "")).strip() or str(draft.get("content") or "").strip()

            if not content:
                return {
                    "success": True,
                    "summary": "I need the reply text before I can prepare the comment response.",
                    "data": {
                        "action": "missing_content",
                        "status": "blocked",
                        "message": "Please tell me the exact reply you want to post under that comment.",
                        "follow_up": "Once you share the reply text, I can prepare it for you.",
                    },
                }

            target_comment = resolve_comment_target(
                payload=payload,
                comment_id=requested_comment_id,
                comment_content=requested_comment_content,
            )
            if not target_comment:
                return {
                    "success": True,
                    "summary": "I need to know which comment you want to reply to.",
                    "data": {
                        "action": "comment_selection_required",
                        "status": "selection_required",
                        "content": content,
                        "message": "Please tell me which comment you want to reply to, or open the post comments first so I can target the right one.",
                        "follow_up": "Once the comment is clear, I can prepare the reply immediately.",
                    },
                }

            comment_id = str(target_comment.get("_id") or target_comment.get("id") or requested_comment_id or "").strip()
            post_id = str(target_comment.get("postId") or target_comment.get("post_id") or "").strip()
            comment_content = str(target_comment.get("content") or requested_comment_content or "").strip()
            comment_author = str((target_comment.get("author") or {}).get("displayName") or "").strip() or None

            if not post_id:
                return {
                    "success": True,
                    "summary": "I found the comment, but I could not safely determine its parent post.",
                    "data": {
                        "action": "missing_post_context",
                        "status": "blocked",
                        "comment_id": comment_id,
                        "comment_content": comment_content,
                        "message": "Please reopen the post comments once so I can reply in the correct thread.",
                        "follow_up": "After that, I can post the reply properly.",
                    },
                }

            if not user_confirmed:
                return {
                    "success": True,
                    "summary": "Ready to publish your reply under the selected comment.",
                    "data": {
                        "action": "confirmation_required",
                        "status": "confirmation_required",
                        "post_id": post_id,
                        "comment_id": comment_id,
                        "comment_content": comment_content,
                        "comment_author": comment_author,
                        "content": content,
                        "message": "I have prepared your reply to that comment. Confirm when you want me to publish it.",
                        "follow_up": "If you want, I can also help you polish the tone before posting it.",
                    },
                }

            comment_response = await self.backend_client.create_comment(
                auth_token,
                post_id,
                content,
                parent_comment_id=comment_id,
            )
            created_comment = comment_response.get("comment") if isinstance(comment_response.get("comment"), dict) else comment_response
            created_comment_id = str(created_comment.get("_id") or created_comment.get("id") or "").strip()

            verified = False
            try:
                comments_state = await self.backend_client.get_post_comments(auth_token, post_id)
                verified = any(
                    str(item.get("_id") or item.get("id") or "").strip() == created_comment_id
                    and str(item.get("parentCommentId") or "").strip() == comment_id
                    for item in comments_state.get("comments", [])
                    if isinstance(item, dict)
                )
            except Exception:
                verified = False

            summary = (
                "Your reply has been added under the selected comment."
                if verified or created_comment_id
                else "I submitted your comment reply, but I could not verify it in the thread yet."
            )
            return {
                "success": True,
                "summary": summary,
                "data": {
                    "action": "comment_reply_created" if verified or created_comment_id else "comment_reply_pending_verification",
                    "status": "published" if verified or created_comment_id else "verification_pending",
                    "verified": verified,
                    "post_id": post_id,
                    "comment_id": comment_id,
                    "comment_content": comment_content,
                    "comment_author": comment_author,
                    "content": content,
                    "reply_comment_id": created_comment_id or None,
                    "comment": created_comment,
                    "message": summary,
                    "follow_up": "If you want, I can also open the updated comment thread or help you reply somewhere else in the discussion.",
                },
            }
        except ToolExecutionError as exc:
            raise self.tool_error(str(exc))
        except Exception:
            raise self.tool_error("I could not publish the comment reply right now. Please try again in a moment.")
