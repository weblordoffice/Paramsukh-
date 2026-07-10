# Tools Implementation Flow: Interactive Community

This document outlines the step-by-step implementation plan for adding Interactive Community tools to the ParamSukh AI assistant.

---

## 1. Backend Client Methods (`app/services/backend_client.py`)
Add methods in `BackendClient` to call the community endpoints:
* `get_my_groups(self, auth_token: str) -> dict[str, Any]`
  - URL: `/api/community/my-groups` (GET)
* `get_group_posts(self, auth_token: str, group_id: str, page: int = 1) -> dict[str, Any]`
  - URL: `/api/community/groups/{groupId}/posts` (GET)
* `create_post(self, auth_token: str, group_id: str, content: str, tags: list[str] = None) -> dict[str, Any]`
  - URL: `/api/community/groups/{groupId}/posts` (POST)
* `get_post_comments(self, auth_token: str, post_id: str) -> dict[str, Any]`
  - URL: `/api/community/posts/{postId}/comments` (GET)
* `create_comment(self, auth_token: str, post_id: str, content: str) -> dict[str, Any]`
  - URL: `/api/community/posts/{postId}/comments` (POST)
* `toggle_post_like(self, auth_token: str, post_id: str) -> dict[str, Any]`
  - URL: `/api/community/posts/{postId}/like` (POST)

---

## 2. AI Service Tools (`app/tools/`)

### A. Information Tools (`app/tools/information_tools/community`)
* **`get_community_groups`**: Retreives the hierarchical plan-to-subgroup mapping or flat list of active groups the user belongs to.
* **`get_community_posts`**: Fetches posts within a specific group.
* **`get_post_comments`**: Fetches comment threads on a post.

### B. Action Tools (`app/tools/action_tools/community`)
* **`create_community_post`**: Publishes a new text post in a group.
* **`create_post_comment`**: Submits a reply comment.
* **`like_community_post`**: Toggles a post's like status.

---

## 3. Tool Registry (`app/tools/registry.py`)
Import and map the new tools in `ToolRegistry.tools`:
* `get_community_groups`
* `get_community_posts`
* `create_community_post`
* `get_post_comments`
* `create_post_comment`
* `like_community_post`

---

## 4. OpenAI Prompting Guidelines (`app/services/openai_service.py`)
Update guidelines to:
- Direct the model to call `get_community_groups` when users ask about discussion forums, groups, or communities.
- Resolve target `group_id` or `post_id` from history before invoking posts, comments, or likes.
- Enable `build_context_lines` to pass group and post metadata back to the model context.

---

## 5. Backend Presentation Service (`backend/src/services/aiToolPresentation.service.js`)
Create presentation section builders:
* `buildGroupListSection(data)` -> outputs section of kind `'group_list'`.
* `buildPostListSection(data)` -> outputs section of kind `'post_list'`.
* `buildCommentListSection(data)` -> outputs section of kind `'comment_list'`.

---

## 6. Mobile App UI & State (`mobile/`)
* **Store Types (`store/aiAssistantStore.ts`)**: Add `'group_list' | 'post_list' | 'comment_list'` to `kind` union and `'like_post' | 'view_comments' | 'write_comment'` to `ctaType`.
* **Presentation UI (`components/AIToolPresentation.tsx`)**:
  - Render list of groups with cover metadata, badges, description, and join dates.
  - Render post items showing author, timestamp, text content, and interactive buttons for like count and comments count.
  - Render comments row stack.
* **Action Handlers (`components/AIChatPanel.tsx`)**:
  - Map `like_post` CTA to call `POST /api/community/posts/{postId}/like` directly.
  - Map `view_comments` to send `"View comments for post {postId}"` to the AI.
  - Map `write_comment` to prompt comment entry.
