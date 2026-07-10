import re
from typing import Any


GENERIC_GROUP_TOKENS = {
    "all",
    "community",
    "communities",
    "discussion",
    "discussions",
    "feed",
    "feeds",
    "forum",
    "forums",
    "group",
    "groups",
    "latest",
    "my",
    "post",
    "posts",
    "show",
    "the",
    "view",
}

GENERIC_POST_TOKENS = {
    "comment",
    "comments",
    "discussion",
    "feed",
    "latest",
    "post",
    "posts",
    "show",
    "the",
    "thread",
    "view",
}

ORDINAL_WORDS = {
    "first": 1,
    "second": 2,
    "third": 3,
    "fourth": 4,
    "fifth": 5,
    "sixth": 6,
    "seventh": 7,
    "eighth": 8,
    "ninth": 9,
    "tenth": 10,
}


def normalize_community_text(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()


def parse_ordinal_reference(message: str) -> int | None:
    normalized = normalize_community_text(message)
    if not normalized:
        return None

    match = re.search(r"\b(\d+)(?:st|nd|rd|th)?\b", normalized)
    if match:
        index = int(match.group(1))
        return index if index > 0 else None

    for word, index in ORDINAL_WORDS.items():
        if re.search(rf"\b{word}\b", normalized):
            return index

    return None


def _group_candidates(groups_payload: dict[str, Any]) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    for key in ("groups", "plan_groups", "other_groups"):
        value = groups_payload.get(key)
        if isinstance(value, list):
            for item in value:
                if isinstance(item, dict):
                    candidates.append(item)
    return candidates


def _extract_group_name(group: dict[str, Any]) -> str:
    return str(group.get("name") or group.get("title") or "").strip()


def _extract_group_id(group: dict[str, Any]) -> str:
    return str(group.get("_id") or group.get("id") or "").strip()


def _extract_post_id(post: dict[str, Any]) -> str:
    return str(post.get("_id") or post.get("id") or "").strip()


def _extract_post_content(post: dict[str, Any]) -> str:
    return str(post.get("content") or post.get("title") or "").strip()


def extract_recent_community_groups(conversation: Any) -> list[dict[str, Any]]:
    if not conversation:
        return []

    for item in reversed(conversation.recent_messages):
        if item.role != "tool" or item.toolName != "get_community_groups" or not isinstance(item.toolPayload, dict):
            continue
        result = item.toolPayload.get("result")
        if not isinstance(result, dict):
            continue
        data = result.get("data")
        if not isinstance(data, dict):
            continue
        groups = _group_candidates(data)
        if groups:
            return groups
    return []


def resolve_community_group(
    *,
    groups: list[dict[str, Any]],
    requested_group_id: str | None = None,
    requested_group_name: str | None = None,
    message: str | None = None,
) -> dict[str, Any] | None:
    valid_groups = [group for group in groups if isinstance(group, dict)]
    if not valid_groups:
        return None

    normalized_group_id = str(requested_group_id or "").strip()
    if normalized_group_id:
        for group in valid_groups:
            if _extract_group_id(group) == normalized_group_id:
                return group

    normalized_name = normalize_community_text(requested_group_name)
    if normalized_name:
        exact_matches = [group for group in valid_groups if normalize_community_text(_extract_group_name(group)) == normalized_name]
        if exact_matches:
            return exact_matches[0]

        partial_matches = [group for group in valid_groups if normalized_name in normalize_community_text(_extract_group_name(group))]
        if len(partial_matches) == 1:
            return partial_matches[0]

    normalized_message = normalize_community_text(message)
    if normalized_message:
        ordinal = parse_ordinal_reference(normalized_message)
        if ordinal and ordinal <= len(valid_groups):
            return valid_groups[ordinal - 1]

        message_tokens = [token for token in normalized_message.split() if token not in GENERIC_GROUP_TOKENS]
        if message_tokens:
            joined = " ".join(message_tokens)
            exact_matches = [group for group in valid_groups if normalize_community_text(_extract_group_name(group)) == joined]
            if exact_matches:
                return exact_matches[0]

            partial_matches = [group for group in valid_groups if joined in normalize_community_text(_extract_group_name(group))]
            if len(partial_matches) == 1:
                return partial_matches[0]

            token_matches = []
            for group in valid_groups:
                name = normalize_community_text(_extract_group_name(group))
                if all(token in name for token in message_tokens):
                    token_matches.append(group)
            if len(token_matches) == 1:
                return token_matches[0]

    if len(valid_groups) == 1:
        return valid_groups[0]

    return None


def extract_recent_community_posts(conversation: Any) -> list[dict[str, Any]]:
    if not conversation:
        return []

    for item in reversed(conversation.recent_messages):
        if item.role != "tool" or item.toolName != "get_community_posts" or not isinstance(item.toolPayload, dict):
            continue
        result = item.toolPayload.get("result")
        if not isinstance(result, dict):
            continue
        data = result.get("data")
        if not isinstance(data, dict):
            continue
        posts = data.get("posts")
        if isinstance(posts, list) and posts:
            return [post for post in posts if isinstance(post, dict)]
    return []


def resolve_community_post(
    *,
    posts: list[dict[str, Any]],
    requested_post_id: str | None = None,
    message: str | None = None,
) -> dict[str, Any] | None:
    valid_posts = [post for post in posts if isinstance(post, dict)]
    if not valid_posts:
        return None

    normalized_post_id = str(requested_post_id or "").strip()
    if normalized_post_id:
        for post in valid_posts:
            if _extract_post_id(post) == normalized_post_id:
                return post

    normalized_message = normalize_community_text(message)
    if normalized_message:
        ordinal = parse_ordinal_reference(normalized_message)
        if ordinal and ordinal <= len(valid_posts):
            return valid_posts[ordinal - 1]

        if re.search(r"\b(this|that|it|latest|recent|top|first)\b", normalized_message):
            return valid_posts[0]

        tokens = [token for token in normalized_message.split() if token not in GENERIC_POST_TOKENS]
        if tokens:
            joined = " ".join(tokens)
            exact_matches = [post for post in valid_posts if normalize_community_text(_extract_post_content(post)) == joined]
            if exact_matches:
                return exact_matches[0]

            partial_matches = [post for post in valid_posts if joined in normalize_community_text(_extract_post_content(post))]
            if len(partial_matches) == 1:
                return partial_matches[0]

    if len(valid_posts) == 1:
        return valid_posts[0]

    return None
