from typing import Any
from app.models.chat import ChatRequest
from app.tools.information_tools.courses.shared import (
    CourseInformationTool,
    resolve_course_target,
    matches_course_query,
)


class GetCourseDetailsTool(CourseInformationTool):
    name = "get_course_details"
    description = (
        "Get comprehensive details for a specific course, including its syllabus/videos list, "
        "description, rating, duration, and status. Useful when a user asks about lessons in a course, "
        "what is covered in it, or wants to explore a specific course by name, id, or slug."
    )
    parameters = {
        "type": "object",
        "properties": {
            "course_id": {
                "type": "string",
                "description": "Optional specific course ID from previous context.",
            },
            "course_title": {
                "type": "string",
                "description": "Optional course title reference or keywords when referencing a course name.",
            },
            "slug": {
                "type": "string",
                "description": "Optional course slug reference.",
            }
        },
        "additionalProperties": False,
    }

    async def execute(self, arguments: dict[str, Any], payload: ChatRequest) -> dict[str, Any]:
        course_id = str(arguments.get("course_id", "")).strip() or None
        course_title = str(arguments.get("course_title", "")).strip() or None
        slug = str(arguments.get("slug", "")).strip() or None

        resolved_course_id = None
        resolved_course_title = None

        # 1. Resolve from course_id directly
        if course_id:
            resolved_course_id = course_id
            resolved_course_title = course_title
        # 2. Try to resolve via slug
        elif slug:
            try:
                public_detail = await self.backend_client.get_course_by_slug(slug)
                resolved_course_id = public_detail.get("id")
                resolved_course_title = public_detail.get("title")
            except Exception:
                pass

        # 3. Resolve from recent candidates or title match
        if not resolved_course_id:
            resolved_course_id, resolved_course_title = resolve_course_target(payload, course_id, course_title)

        # 4. If still not resolved, but we have a course_title, query the database/catalog to find matching course
        if not resolved_course_id and course_title:
            try:
                if payload.backend_auth_token:
                    catalog = await self.backend_client.get_enrollment_catalog(self.require_auth_token(payload))
                    catalog_items = catalog["items"]
                    matched = next((c for c in catalog_items if matches_course_query(c, course_title)), None)
                    if matched:
                        resolved_course_id = matched.get("id")
                        resolved_course_title = matched.get("title")
                else:
                    public_courses = await self.backend_client.get_courses(course_title, limit=1)
                    if public_courses.get("items"):
                        matched = public_courses["items"][0]
                        resolved_course_id = matched.get("id")
                        resolved_course_title = matched.get("title")
            except Exception:
                pass

        if not resolved_course_id:
            raise self.tool_error(
                f"I could not find details for the course '{course_title or slug or 'requested'}'."
            )

        # 5. Fetch course details (try enrolled check first if token is available)
        data = None
        is_enrolled = False
        if payload.backend_auth_token:
            try:
                enrolled_details = await self.backend_client.get_enrolled_course_detail(
                    self.require_auth_token(payload), resolved_course_id
                )
                data = enrolled_details
                is_enrolled = True
            except Exception:
                # Not enrolled or check failed
                pass

        if not data:
            public_course = await self.backend_client.get_course_by_id(resolved_course_id)
            data = {
                "course": public_course,
                "videos": public_course.get("videos") or [],
                "is_enrolled": False
            }

        summary = (
            f"Found syllabus and progress details for the enrolled course '{resolved_course_title or 'requested'}'."
            if is_enrolled
            else f"Found syllabus and information for the course '{resolved_course_title or 'requested'}'."
        )

        return {
            "success": True,
            "summary": summary,
            "data": data,
        }
