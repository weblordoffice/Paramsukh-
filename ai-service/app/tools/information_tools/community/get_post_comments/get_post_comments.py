from typing import Any

from app.core.exceptions import ToolExecutionError
from app.models.chat import ChatRequest
from app.services.backend_client import BackendClient
from app.tools.common import AppTool
from app.tools.information_tools.community.shared import (
    extract_recent_community_posts,
    resolve_community_post,
)


class GetPostCommentsTool(AppTool):
    name = "get_post_comments"
    description = (
        "Retrieve the comment thread for a community post. "
        "Use this tool when the user wants to read replies, discussion comments, "
        "or follow-up conversation on a post they are viewing."
    )
    parameters = {
        "type": "object",
        "properties": {
            "post_id": {
                "type": "string",
                "description": "The unique database ID of the post when it is already known.",
            },
        },
        "additionalProperties": False,
    }

    async def execute(self, arguments: dict[str, Any], payload: ChatRequest) -> dict[str, Any]:
        auth_token = self.require_auth_token(payload)
        client = BackendClient()

        try:
            recent_posts = extract_recent_community_posts(payload.conversation)
            resolved_post = resolve_community_post(
                posts=recent_posts,
                requested_post_id=arguments.get("post_id"),
                message=payload.message,
            )

            post_id = str(arguments.get("post_id") or "").strip()
            post_content = ""
            if resolved_post:
                post_id = str(resolved_post.get("_id") or resolved_post.get("id") or post_id).strip()
                post_content = str(resolved_post.get("content") or "").strip()

            if not post_id:
                if not recent_posts:
                    return {
                        "success": False,
                        "message": "I need the post context first before I can open its comment thread.",
                        "data": {
                            "next_step": "load_posts_first",
                            "follow_up": "Ask me to show the community posts first, and then I can open the right comment thread for you.",
                        },
                    }
                return {
                    "success": False,
                    "message": "I could not confidently tell which post you wanted comments for.",
                    "data": {
                        "available_posts": [
                            {
                                "id": str(post.get("_id") or post.get("id") or "").strip(),
                                "content": str(post.get("content") or "").strip(),
                            }
                            for post in recent_posts[:5]
                            if isinstance(post, dict)
                        ],
                        "follow_up": "Tell me which post you mean, or tap the comments action on the post card.",
                    },
                }

            res = await client.get_post_comments(auth_token, post_id)
            comments = res.get("comments", [])
            total_comments = len(comments)
            post_label = post_content or "this post"
            if len(post_label) > 72:
                post_label = post_label[:69].rstrip() + "..."

            if total_comments == 0:
                summary = f"I checked the discussion on {post_label}, and there are no comments yet."
            elif total_comments == 1:
                summary = f"I found 1 comment on {post_label}."
            else:
                summary = f"I found {total_comments} comments on {post_label}."

            return {
                "success": True,
                "summary": summary,
                "data": {
                    "post_id": post_id,
                    "post_content": post_content or None,
                    "comments": comments,
                    "total_comments": res.get("total_comments", total_comments),
                    "follow_up": (
                        "If you want, I can also help you reply to this post, answer a specific comment, or open another discussion thread."
                        if total_comments > 0
                        else "If you want, I can also help you reply first or open another post from this community."
                    ),
                },
            }
        except ToolExecutionError as exc:
            raise exc
        except Exception:
            return {
                "success": False,
                "message": "I could not load the post comments right now. Please try again in a moment.",
            }
