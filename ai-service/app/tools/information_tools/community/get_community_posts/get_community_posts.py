from typing import Any

from app.models.chat import ChatRequest
from app.services.backend_client import BackendClient
from app.tools.common import AppTool
from app.core.exceptions import ToolExecutionError
from app.tools.information_tools.community.shared import (
    extract_recent_community_groups,
    resolve_community_group,
)


class GetCommunityPostsTool(AppTool):
    name = "get_community_posts"
    description = (
        "Retrieve discussion posts and feeds from a specific community group. "
        "Use this tool when the user wants to view the latest discussions, posts, "
        "or social feed within a group they belong to."
    )
    parameters = {
        "type": "object",
        "properties": {
            "group_id": {
                "type": "string",
                "description": "The unique database ID of the group to fetch posts from, when already known.",
            },
            "group_name": {
                "type": "string",
                "description": "Optional group name or label when the user refers to a community by name instead of ID.",
            },
            "page": {
                "type": "integer",
                "description": "Optional page number for paginated posts (starts at 1).",
                "default": 1,
            },
        },
        "additionalProperties": False,
    }

    async def execute(self, arguments: dict[str, Any], payload: ChatRequest) -> dict[str, Any]:
        auth_token = self.require_auth_token(payload)

        client = BackendClient()
        try:
            raw_page = arguments.get("page", 1)
            page = raw_page if isinstance(raw_page, int) and raw_page > 0 else 1

            available_groups = extract_recent_community_groups(payload.conversation)
            if not available_groups:
                groups_response = await client.get_my_groups(auth_token)
                available_groups = []
                for key in ("groups", "plan_groups", "other_groups"):
                    value = groups_response.get(key)
                    if isinstance(value, list):
                        available_groups.extend(item for item in value if isinstance(item, dict))

            group = resolve_community_group(
                groups=available_groups,
                requested_group_id=arguments.get("group_id"),
                requested_group_name=arguments.get("group_name"),
                message=payload.message,
            )

            group_id = str(arguments.get("group_id") or "").strip()
            group_name = str(arguments.get("group_name") or "").strip()
            if group:
                group_id = str(group.get("_id") or group.get("id") or group_id).strip()
                group_name = str(group.get("name") or group.get("title") or group_name).strip()

            if not group_id:
                if not available_groups:
                    return {
                        "success": False,
                        "message": "I need your community group list first before I can open a discussion feed.",
                        "data": {
                            "next_step": "load_groups_first",
                            "follow_up": "Ask me to show your community groups, and then I can open the right discussion feed for you.",
                        },
                    }
                return {
                    "success": False,
                    "message": "I could not confidently tell which community group you meant.",
                    "data": {
                        "available_groups": [
                            {
                                "id": str(item.get("_id") or item.get("id") or "").strip(),
                                "name": str(item.get("name") or item.get("title") or "").strip(),
                            }
                            for item in available_groups
                            if isinstance(item, dict)
                        ],
                        "follow_up": "Tell me the group name you want, or tap one of the community groups first.",
                    },
                }

            res = await client.get_group_posts(auth_token, group_id, page)
            posts = res.get("posts", [])
            resolved_group_name = group_name or str(res.get("group_name") or res.get("groupName") or "this group").strip()
            if not posts:
                summary = f"I checked {resolved_group_name}, and there are no posts yet."
            elif len(posts) == 1:
                summary = f"I found 1 recent post in {resolved_group_name}."
            else:
                summary = f"I found {len(posts)} recent posts in {resolved_group_name}."
            return {
                "success": True,
                "summary": summary,
                "data": {
                    **res,
                    "group_id": group_id,
                    "group_name": resolved_group_name,
                    "follow_up": (
                        "If you want, I can also open the comments on a post, like a post, or check another community feed."
                        if posts
                        else "If you want, I can also open another group or help you check your other communities."
                    ),
                },
            }
        except ToolExecutionError as exc:
            raise exc
        except Exception:
            return {
                "success": False,
                "message": "I could not load the community posts right now. Please try again in a moment.",
            }
