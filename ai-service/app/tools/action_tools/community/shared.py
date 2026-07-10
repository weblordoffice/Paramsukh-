from __future__ import annotations

import re
from typing import Any

from app.models.chat import ChatRequest
from app.services.backend_client import BackendClient
from app.tools.information_tools.community.shared import (
    extract_recent_community_groups,
    extract_recent_community_posts,
    normalize_community_text,
    resolve_community_group,
    resolve_community_post,
)


def compact_text(value: str | None, *, limit: int = 96) -> str:
    text = " ".join(str(value or "").strip().split())
    if len(text) <= limit:
        return text
    return text[: limit - 3].rstrip() + "..."


def normalize_tags(tags: Any) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()

    if isinstance(tags, list):
        raw_values = tags
    elif isinstance(tags, str):
        raw_values = re.split(r"[,#\n]+", tags)
    else:
        raw_values = []

    for raw in raw_values:
        tag = re.sub(r"[^a-zA-Z0-9_-]+", "", str(raw or "").strip().lower())
        if not tag or tag in seen:
            continue
        seen.add(tag)
        normalized.append(tag)

    return normalized[:8]


def extract_tags_from_content(content: str | None) -> list[str]:
    if not content:
        return []
    matches = re.findall(r"#([A-Za-z0-9_-]{2,32})", content)
    return normalize_tags(matches)


def extract_recent_action_draft(payload: ChatRequest, tool_name: str) -> dict[str, Any] | None:
    conversation = payload.conversation
    if not conversation:
        return None

    for item in reversed(conversation.recent_messages):
        if item.role != "tool" or item.toolName != tool_name or not isinstance(item.toolPayload, dict):
            continue
        result = item.toolPayload.get("result")
        if not isinstance(result, dict):
            continue
        data = result.get("data")
        if isinstance(data, dict) and data.get("action") == "confirmation_required":
            return data
    return None


async def resolve_group_target(
    *,
    payload: ChatRequest,
    backend_client: BackendClient,
    auth_token: str,
    group_id: str | None = None,
    group_name: str | None = None,
) -> dict[str, Any] | None:
    groups = extract_recent_community_groups(payload.conversation)
    if not groups:
        response = await backend_client.get_my_groups(auth_token)
        for key in ("groups", "plan_groups", "other_groups"):
            value = response.get(key)
            if isinstance(value, list):
                groups.extend(item for item in value if isinstance(item, dict))

    return resolve_community_group(
        groups=groups,
        requested_group_id=group_id,
        requested_group_name=group_name,
        message=payload.message,
    )


def extract_recent_post_candidates(payload: ChatRequest) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    seen_ids: set[str] = set()

    for post in extract_recent_community_posts(payload.conversation):
        post_id = str(post.get("_id") or post.get("id") or "").strip()
        if not post_id or post_id in seen_ids:
            continue
        seen_ids.add(post_id)
        candidates.append(post)

    conversation = payload.conversation
    if not conversation:
        return candidates

    for item in reversed(conversation.recent_messages):
        if item.role != "tool" or not isinstance(item.toolPayload, dict):
            continue
        result = item.toolPayload.get("result")
        if not isinstance(result, dict):
            continue
        data = result.get("data")
        if not isinstance(data, dict):
            continue

        post = data.get("post")
        if isinstance(post, dict):
            post_id = str(post.get("_id") or post.get("id") or data.get("post_id") or "").strip()
            if post_id and post_id not in seen_ids:
                seen_ids.add(post_id)
                enriched_post = dict(post)
                if "_id" not in enriched_post and post_id:
                    enriched_post["_id"] = post_id
                if "content" not in enriched_post and data.get("post_content"):
                    enriched_post["content"] = data.get("post_content")
                if "userLiked" not in enriched_post and data.get("user_liked") is not None:
                    enriched_post["userLiked"] = data.get("user_liked")
                candidates.append(enriched_post)

    return candidates


def resolve_post_target(
    *,
    payload: ChatRequest,
    post_id: str | None = None,
    post_content: str | None = None,
) -> dict[str, Any] | None:
    posts = extract_recent_post_candidates(payload)
    resolved = resolve_community_post(
        posts=posts,
        requested_post_id=post_id,
        message=payload.message,
    )
    if resolved:
        return resolved

    normalized_content = normalize_community_text(post_content)
    if normalized_content:
        for post in posts:
            content = normalize_community_text(str(post.get("content") or post.get("title") or ""))
            if content == normalized_content or normalized_content in content:
                return post

    return None


def extract_recent_comment_candidates(payload: ChatRequest) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    conversation = payload.conversation
    if not conversation:
        return candidates

    for item in reversed(conversation.recent_messages):
        if item.role != "tool" or not isinstance(item.toolPayload, dict):
            continue
        if item.toolName not in {"get_post_comments", "create_post_comment", "reply_to_post_comment"}:
            continue

        result = item.toolPayload.get("result")
        if not isinstance(result, dict):
            continue
        data = result.get("data")
        if not isinstance(data, dict):
            continue

        comment_list = data.get("comments")
        if isinstance(comment_list, list):
            for comment in comment_list:
                if not isinstance(comment, dict):
                    continue
                comment_id = str(comment.get("_id") or comment.get("id") or "").strip()
                if not comment_id or comment_id in seen_ids:
                    continue
                seen_ids.add(comment_id)
                enriched_comment = dict(comment)
                if "postId" not in enriched_comment and data.get("post_id"):
                    enriched_comment["postId"] = data.get("post_id")
                candidates.append(enriched_comment)

        comment = data.get("comment")
        if isinstance(comment, dict):
            comment_id = str(comment.get("_id") or comment.get("id") or data.get("comment_id") or "").strip()
            if comment_id and comment_id not in seen_ids:
                seen_ids.add(comment_id)
                enriched_comment = dict(comment)
                if "_id" not in enriched_comment:
                    enriched_comment["_id"] = comment_id
                if "postId" not in enriched_comment and data.get("post_id"):
                    enriched_comment["postId"] = data.get("post_id")
                candidates.append(enriched_comment)

    return candidates


def resolve_comment_target(
    *,
    payload: ChatRequest,
    comment_id: str | None = None,
    comment_content: str | None = None,
) -> dict[str, Any] | None:
    comments = extract_recent_comment_candidates(payload)
    normalized_id = str(comment_id or "").strip()
    if normalized_id:
        for comment in comments:
            if str(comment.get("_id") or comment.get("id") or "").strip() == normalized_id:
                return comment

    normalized_message = normalize_community_text(payload.message)
    if normalized_message:
        ordinal_map = {
            "first": 1, "1st": 1, "one": 1,
            "second": 2, "2nd": 2, "two": 2,
            "third": 3, "3rd": 3, "three": 3,
            "fourth": 4, "4th": 4, "four": 4,
            "fifth": 5, "5th": 5, "five": 5,
        }
        for token in normalized_message.split():
            if token in ordinal_map and ordinal_map[token] <= len(comments):
                return comments[ordinal_map[token] - 1]

    normalized_content = normalize_community_text(comment_content)
    if normalized_content:
        for comment in comments:
            content = normalize_community_text(str(comment.get("content") or ""))
            if content == normalized_content or normalized_content in content:
                return comment

    if len(comments) == 1:
        return comments[0]

    return None
