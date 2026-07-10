from app.models.chat import ChatRequest
from app.tools.information_tools.courses.shared import CourseInformationTool, clamp_limit


class RecommendCoursesTool(CourseInformationTool):
    name = "recommend_courses"
    description = (
        "Recommend the best-fit ParamSukh courses by combining the user's topic, learning intent, "
        "current enrollments, and membership access constraints when available."
    )
    parameters = {
        "type": "object",
        "properties": {
            "topic": {
                "type": "string",
                "description": "Main topic, goal, or interest area for recommendations.",
            },
            "category": {
                "type": "string",
                "description": "Optional category preference for narrowing course recommendations.",
            },
            "beginner_only": {
                "type": "boolean",
                "description": "Whether to favor beginner-friendly recommendations.",
                "default": False,
            },
            "limit": {
                "type": "integer",
                "description": "Maximum number of recommendations to return.",
                "minimum": 1,
                "maximum": 6,
                "default": 4,
            },
        },
        "required": ["topic"],
        "additionalProperties": False,
    }

    @staticmethod
    def _score_course(
        course: dict[str, object],
        *,
        topic: str,
        category: str | None,
        beginner_only: bool,
    ) -> int:
        score = 0
        topic_lower = topic.lower()
        category_lower = category.lower() if category else None
        title = str(course.get("title") or "").lower()
        description = str(course.get("description") or "").lower()
        course_category = str(course.get("category") or "").lower()
        tags = [str(tag).lower() for tag in course.get("tags") or []]
        access = course.get("access") or {}

        if topic_lower in title:
            score += 7
        if topic_lower in description:
            score += 5
        if any(topic_lower in tag for tag in tags):
            score += 4
        if category_lower and category_lower == course_category:
            score += 4
        if beginner_only and any(keyword in description for keyword in ("beginner", "intro", "foundation", "basic")):
            score += 3
        if access.get("canEnroll") is True:
            score += 3
        if access.get("canAccess") is True:
            score += 2
        if access.get("reason") == "already_enrolled":
            score -= 12

        rating = course.get("average_rating")
        if isinstance(rating, (int, float)):
            score += min(3, int(round(float(rating) / 2)))

        return score

    async def execute(self, arguments: dict[str, object], payload: ChatRequest) -> dict[str, object]:
        topic = str(arguments.get("topic", "")).strip()
        if not topic:
            raise self.tool_error("topic is required")

        category = str(arguments.get("category", "")).strip() or None
        beginner_only = bool(arguments.get("beginner_only", False))
        limit = clamp_limit(arguments.get("limit", 4), default=4, minimum=1, maximum=6)

        catalog_items: list[dict[str, object]]
        if payload.backend_auth_token:
            catalog = await self.backend_client.get_enrollment_catalog(self.require_auth_token(payload))
            catalog_items = catalog["items"]
        else:
            catalog = await self.backend_client.get_courses(topic)
            catalog_items = catalog["items"]

        ranked = sorted(
            (
                {
                    **course,
                    "recommendation_score": self._score_course(
                        course,
                        topic=topic,
                        category=category,
                        beginner_only=beginner_only,
                    ),
                }
                for course in catalog_items
            ),
            key=lambda item: item["recommendation_score"],
            reverse=True,
        )

        filtered = [item for item in ranked if item["recommendation_score"] > 0][:limit]

        return {
            "success": True,
            "summary": f"Prepared {len(filtered)} course recommendation(s) for '{topic}'.",
            "data": {
                "items": filtered,
                "total": len(filtered),
                "topic": topic,
                "category": category,
                "beginner_only": beginner_only,
            },
        }
