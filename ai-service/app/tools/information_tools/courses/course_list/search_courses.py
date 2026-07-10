from app.models.chat import ChatRequest
from app.tools.information_tools.courses.shared import (
    CourseInformationTool,
    clamp_limit,
    matches_course_query,
    normalize_course_catalog_query,
)


class SearchCoursesTool(CourseInformationTool):
    name = "search_courses"
    description = (
        "Search ParamSukh courses and learning catalog when a user asks about "
        "courses, topics, learning paths, or relevant study material."
    )
    parameters = {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Optional course topic, category, or learning intent. Leave empty for all available courses.",
            },
            "limit": {
                "type": "integer",
                "description": "Maximum number of courses to return.",
                "minimum": 1,
                "maximum": 20,
                "default": 12,
            },
        },
        "additionalProperties": False,
    }

    async def execute(self, arguments: dict[str, object], payload: ChatRequest) -> dict[str, object]:
        query = normalize_course_catalog_query(str(arguments.get("query", "")))
        limit = clamp_limit(arguments.get("limit", 12), default=12, minimum=1, maximum=20)

        if payload.backend_auth_token:
            catalog = await self.backend_client.get_enrollment_catalog(self.require_auth_token(payload))
            catalog_items = catalog["items"]
            if query:
                filtered_items = [course for course in catalog_items if matches_course_query(course, query)]
            else:
                filtered_items = catalog_items

            filtered_items = sorted(
                filtered_items,
                key=lambda item: (
                    not bool((item.get("access") or {}).get("canAccess") or (item.get("access") or {}).get("canEnroll")),
                    -float(item.get("average_rating") or 0),
                    -int(item.get("enrollment_count") or 0),
                    str(item.get("title") or "").lower(),
                ),
            )
            data = {
                "items": filtered_items[:limit],
                "total": len(filtered_items),
                "query": query,
                "listing_mode": "catalog" if not query else "search",
                "access_aware": True,
            }
        else:
            data = await self.backend_client.get_courses(query, limit=limit)
            data["access_aware"] = False

        summary = (
            f"Found {data['total']} available course(s) in the catalog."
            if not query
            else f"Found {data['total']} matching course(s)."
        )
        return {
            "success": True,
            "summary": summary,
            "data": data,
        }
