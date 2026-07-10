from __future__ import annotations

from typing import Any

import httpx

from app.core.config import get_settings
from app.core.exceptions import ConfigurationError, ToolExecutionError
from app.core.logging import get_logger

logger = get_logger(__name__)


class BackendClient:
    def __init__(self) -> None:
        self.settings = get_settings()

    def _build_headers(
        self,
        *,
        auth_token: str | None = None,
        use_admin_key: bool = False,
    ) -> dict[str, str]:
        headers: dict[str, str] = {}

        if auth_token:
            headers["Authorization"] = f"Bearer {auth_token}"

        if use_admin_key and self.settings.backend_internal_api_key:
            headers["X-Admin-API-Key"] = self.settings.backend_internal_api_key

        return headers

    async def _request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        json_body: dict[str, Any] | None = None,
        auth_token: str | None = None,
        use_admin_key: bool = False,
    ) -> dict[str, Any]:
        base_url = self.settings.backend_base_url.rstrip("/")
        url = f"{base_url}{path}"
        headers = self._build_headers(auth_token=auth_token, use_admin_key=use_admin_key)

        try:
            async with httpx.AsyncClient(timeout=self.settings.request_timeout_seconds) as client:
                response = await client.request(method, url, params=params, json=json_body, headers=headers)
        except httpx.TimeoutException as exc:
            logger.warning("Backend timeout calling %s", url)
            raise ToolExecutionError("backend_request", "Backend request timed out.", details=str(exc)) from exc
        except httpx.RequestError as exc:
            logger.exception("Backend network error calling %s", url)
            raise ToolExecutionError(
                "backend_request",
                "Could not reach the backend service.",
                details=str(exc),
            ) from exc

        try:
            payload = response.json()
        except ValueError:
            payload = {"success": False, "message": "Backend returned non-JSON response."}

        if response.status_code == 401:
            raise ToolExecutionError("backend_request", "Authentication is required for this tool.")
        if response.status_code == 403:
            raise ToolExecutionError("backend_request", "This tool does not have permission to access that data.")
        if response.status_code == 404:
            raise ToolExecutionError("backend_request", payload.get("message", "Requested resource was not found."))
        if response.status_code >= 400:
            raise ToolExecutionError(
                "backend_request",
                payload.get("message", "Backend request failed."),
                details=f"status={response.status_code}",
            )

        if isinstance(payload, dict) and payload.get("success") is False:
            raise ToolExecutionError("backend_request", payload.get("message", "Backend request was unsuccessful."))

        return payload

    @staticmethod
    def _normalize_course_item(item: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": item.get("_id"),
            "title": item.get("title"),
            "description": item.get("description") or item.get("shortDescription"),
            "category": item.get("category"),
            "duration": item.get("duration"),
            "status": item.get("status"),
            "tags": item.get("tags") or [],
            "included_in_plans": item.get("includedInPlans") or [],
            "thumbnail_url": item.get("thumbnailUrl"),
            "banner_url": item.get("bannerUrl"),
            "icon": item.get("icon"),
            "color": item.get("color"),
            "slug": item.get("slug"),
            "average_rating": item.get("averageRating"),
            "review_count": item.get("reviewCount"),
            "enrollment_count": item.get("enrollmentCount"),
            "completion_count": item.get("completionCount"),
            "total_videos": item.get("totalVideos"),
            "total_pdfs": item.get("totalPdfs"),
            "created_at": item.get("createdAt"),
        }

    @staticmethod
    def _normalize_course_video(item: dict[str, Any], *, fallback_order: int = 0) -> dict[str, Any]:
        return {
            "id": item.get("_id"),
            "title": item.get("title"),
            "description": item.get("description"),
            "duration": item.get("duration"),
            "video_url": item.get("videoUrl"),
            "thumbnail_url": item.get("thumbnailUrl"),
            "order": item.get("order") if isinstance(item.get("order"), (int, float)) else fallback_order,
            "is_free": bool(item.get("isFree")),
        }

    @staticmethod
    def _coerce_numeric(value: Any) -> float:
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            try:
                return float(value)
            except ValueError:
                return 0.0
        return 0.0

    async def get_courses(self, query: str | None = None, *, limit: int = 12) -> dict[str, Any]:
        normalized_query = (query or "").strip()
        payload = await self._request(
            "GET",
            "/api/courses/all",
            params={"search": normalized_query},
        )
        courses = payload.get("courses", [])
        normalized = [
            self._normalize_course_item(item)
            for item in courses
            if isinstance(item, dict)
        ]
        if normalized_query:
            q = normalized_query.lower()
            normalized = [
                item for item in normalized
                if q in (item.get("title") or "").lower()
                or q in (item.get("description") or "").lower()
                or q in (item.get("category") or "").lower()
                or any(q in str(tag).lower() for tag in item.get("tags") or [])
            ]
        else:
            normalized.sort(
                key=lambda item: (
                    str(item.get("status") or "") != "published",
                    -(item.get("average_rating") or 0),
                    -(item.get("enrollment_count") or 0),
                    str(item.get("title") or "").lower(),
                )
            )
        return {
            "items": normalized[:limit],
            "total": len(normalized),
            "query": normalized_query,
            "listing_mode": "catalog" if not normalized_query else "search",
        }

    async def get_enrollment_catalog(self, auth_token: str) -> dict[str, Any]:
        if not auth_token:
            raise ConfigurationError("Course catalog lookup requires a backend auth token.")
        payload = await self._request("GET", "/api/enrollments/catalog", auth_token=auth_token)
        courses = payload.get("courses", [])
        normalized = []
        for item in courses:
            if not isinstance(item, dict):
                continue
            normalized.append(
                {
                    **self._normalize_course_item(item),
                    "access": item.get("access") or {},
                }
            )
        return {"items": normalized, "total": len(normalized)}

    async def get_events(self, query: str | None, *, upcoming_only: bool = False) -> dict[str, Any]:
        params: dict[str, Any] = {"limit": 20}
        if query:
            params["search"] = query
        if upcoming_only:
            params["upcoming"] = "true"
        payload = await self._request("GET", "/api/events/all", params=params)
        events = payload.get("events", [])
        normalized = [
            {
                "id": item.get("_id"),
                "title": item.get("title"),
                "description": item.get("description") or item.get("shortDescription"),
                "category": item.get("category"),
                "event_date": item.get("eventDate"),
                "event_time": item.get("eventTime"),
                "location": item.get("location"),
                "location_type": item.get("locationType"),
                "is_paid": item.get("isPaid"),
                "price": item.get("price"),
                "status": item.get("status"),
            }
            for item in events
        ]
        return {
            "items": normalized,
            "total": payload.get("pagination", {}).get("totalEvents", len(normalized)),
            "query": query or "",
        }

    async def get_public_memberships(self) -> dict[str, Any]:
        payload = await self._request("GET", "/api/membership-plans/public")
        plans = payload.get("data", [])
        normalized = [
            {
                "id": item.get("_id"),
                "title": item.get("title"),
                "slug": item.get("slug"),
                "short_description": item.get("shortDescription"),
                "validity_days": item.get("validityDays"),
                "pricing": item.get("pricing"),
                "benefits": item.get("benefits") or [],
            }
            for item in plans
        ]
        return {"items": normalized, "total": payload.get("total", len(normalized))}

    async def get_public_podcasts(self, category: str | None = None) -> dict[str, Any]:
        params = {"category": category} if category else None
        payload = await self._request("GET", "/api/podcasts/", params=params)
        podcasts = payload.get("data", {}).get("podcasts", [])
        normalized = [
            {
                "id": item.get("_id"),
                "title": item.get("title"),
                "description": item.get("description"),
                "host": item.get("host"),
                "category": item.get("category"),
                "duration": item.get("duration"),
                "access_type": item.get("accessType"),
            }
            for item in podcasts
        ]
        return {"items": normalized, "total": payload.get("count", len(normalized))}

    async def get_user_accessible_podcasts(self, auth_token: str) -> dict[str, Any]:
        if not auth_token:
            raise ConfigurationError("Authenticated podcast access requires a backend auth token.")
        payload = await self._request("GET", "/api/podcasts/user/accessible", auth_token=auth_token)
        podcasts = payload.get("data", {}).get("podcasts", [])
        normalized = [
            {
                "id": item.get("_id"),
                "title": item.get("title"),
                "description": item.get("description"),
                "host": item.get("host"),
                "category": item.get("category"),
                "duration": item.get("duration"),
                "access_type": item.get("accessType"),
                "can_access": item.get("canAccess"),
                "access_reason": item.get("accessReason"),
            }
            for item in podcasts
        ]
        return {"items": normalized, "total": payload.get("count", len(normalized))}

    async def get_podcast_details(self, podcast_id: str, auth_token: str | None = None) -> dict[str, Any]:
        payload = await self._request("GET", f"/api/podcasts/{podcast_id}/details", auth_token=auth_token)
        podcast = payload.get("data", {}).get("podcast") or payload.get("podcast") or {}
        return {
            "id": podcast.get("_id"),
            "title": podcast.get("title"),
            "description": podcast.get("description"),
            "host": podcast.get("host"),
            "category": podcast.get("category"),
            "duration": podcast.get("duration"),
            "access_type": podcast.get("accessType"),
            "can_access": payload.get("data", {}).get("canAccess") if payload.get("data") else None,
            "access_reason": payload.get("data", {}).get("accessReason") if payload.get("data") else None,
        }

    async def get_my_enrollments(
        self,
        auth_token: str,
        *,
        completed_only: bool = False,
        in_progress_only: bool = False,
        limit: int | None = None,
    ) -> dict[str, Any]:
        if not auth_token:
            raise ConfigurationError("Enrollment lookup requires a backend auth token.")
        params: dict[str, Any] = {}
        if completed_only:
            params["completed"] = "true"
        if in_progress_only:
            params["inProgress"] = "true"

        payload = await self._request(
            "GET",
            "/api/enrollments/my-courses",
            auth_token=auth_token,
            params=params or None,
        )
        enrollments = payload.get("enrollments") or payload.get("data") or payload.get("courses") or []
        normalized = []
        for item in enrollments:
            course = item.get("courseId") if isinstance(item, dict) else None
            normalized.append(
                {
                    "enrollment_id": item.get("_id") if isinstance(item, dict) else None,
                    "course_id": course.get("_id") if isinstance(course, dict) else item.get("courseId"),
                    "course_title": course.get("title") if isinstance(course, dict) else item.get("title"),
                    "course_description": course.get("description") if isinstance(course, dict) else item.get("description"),
                    "course_category": course.get("category") if isinstance(course, dict) else item.get("category"),
                    "course_duration": course.get("duration") if isinstance(course, dict) else item.get("duration"),
                    "course_icon": course.get("icon") if isinstance(course, dict) else item.get("icon"),
                    "course_color": course.get("color") if isinstance(course, dict) else item.get("color"),
                    "thumbnail_url": course.get("thumbnailUrl") if isinstance(course, dict) else item.get("thumbnailUrl"),
                    "total_videos": course.get("totalVideos") if isinstance(course, dict) else item.get("totalVideos"),
                    "total_pdfs": course.get("totalPdfs") if isinstance(course, dict) else item.get("totalPdfs"),
                    "progress": item.get("progress"),
                    "status": item.get("status"),
                    "is_completed": item.get("isCompleted"),
                    "completed_at": item.get("completedAt"),
                    "last_accessed_at": item.get("lastAccessedAt"),
                    "enrolled_at": item.get("enrolledAt"),
                    "completed_videos_count": len(item.get("completedVideos") or []) if isinstance(item, dict) else 0,
                    "completed_pdfs_count": len(item.get("completedPdfs") or []) if isinstance(item, dict) else 0,
                    "current_video_index": item.get("currentVideoIndex") if isinstance(item, dict) else None,
                }
            )
        normalized.sort(
            key=lambda item: (
                not bool(item.get("last_accessed_at")),
                str(item.get("last_accessed_at") or ""),
            ),
            reverse=True,
        )
        total_count = len(normalized)
        completed_count = sum(1 for item in normalized if item.get("is_completed") is True)
        in_progress_count = sum(
            1
            for item in normalized
            if item.get("is_completed") is not True and self._coerce_numeric(item.get("progress")) > 0
        )
        not_started_count = sum(
            1
            for item in normalized
            if item.get("is_completed") is not True and self._coerce_numeric(item.get("progress")) <= 0
        )
        average_progress = (
            round(sum(self._coerce_numeric(item.get("progress")) for item in normalized) / len(normalized))
            if normalized
            else 0
        )
        visible_items = normalized[:limit] if limit is not None else normalized
        return {
            "items": visible_items,
            "total": total_count,
            "visible_count": len(visible_items),
            "completed_count": completed_count,
            "in_progress_count": in_progress_count,
            "not_started_count": not_started_count,
            "average_progress": average_progress,
            "completed_only": completed_only,
            "in_progress_only": in_progress_only,
        }

    async def get_continue_learning(self, auth_token: str, *, limit: int = 5) -> dict[str, Any]:
        if not auth_token:
            raise ConfigurationError("Continue learning lookup requires a backend auth token.")
        payload = await self._request(
            "GET",
            "/api/enrollments/continue-learning",
            auth_token=auth_token,
            params={"limit": limit},
        )
        courses = payload.get("courses") or []
        normalized = [
            {
                "enrollment_id": item.get("enrollment", {}).get("_id"),
                "progress": item.get("enrollment", {}).get("progress"),
                "current_video_index": item.get("enrollment", {}).get("currentVideoIndex"),
                "last_accessed_at": item.get("enrollment", {}).get("lastAccessedAt"),
                "course_id": item.get("course", {}).get("_id"),
                "course_title": item.get("course", {}).get("title"),
                "course_icon": item.get("course", {}).get("icon"),
                "course_color": item.get("course", {}).get("color"),
                "thumbnail_url": item.get("course", {}).get("thumbnailUrl"),
                "total_videos": item.get("course", {}).get("totalVideos"),
            }
            for item in courses
            if isinstance(item, dict)
        ]
        return {"items": normalized, "total": len(normalized), "limit": limit}

    async def get_course_progress(self, auth_token: str, course_id: str) -> dict[str, Any]:
        if not auth_token:
            raise ConfigurationError("Course progress lookup requires a backend auth token.")
        payload = await self._request(
            "GET",
            f"/api/enrollments/course/{course_id}/progress",
            auth_token=auth_token,
        )
        progress = payload.get("progress") or {}
        return {
            "course_id": course_id,
            "percentage": progress.get("percentage"),
            "is_completed": progress.get("isCompleted"),
            "completed_at": progress.get("completedAt"),
            "completed_videos": progress.get("completedVideos") or [],
            "completed_pdfs": progress.get("completedPdfs") or [],
            "total_videos": progress.get("totalVideos"),
            "total_pdfs": progress.get("totalPdfs"),
            "current_video_id": progress.get("currentVideoId"),
            "current_video_index": progress.get("currentVideoIndex"),
            "last_accessed_at": progress.get("lastAccessedAt"),
            "enrolled_at": progress.get("enrolledAt"),
        }

    async def get_course_by_id(self, course_id: str) -> dict[str, Any]:
        payload = await self._request("GET", f"/api/courses/{course_id}")
        course = payload.get("course") or {}
        normalized_course = self._normalize_course_item(course)
        videos_raw = course.get("videos") or []
        normalized_videos = [
            self._normalize_course_video(item, fallback_order=index)
            for index, item in enumerate(videos_raw)
            if isinstance(item, dict)
        ]
        normalized_videos.sort(key=lambda item: int(item.get("order") or 0))
        return {
            **normalized_course,
            "videos": normalized_videos,
            "total_videos": len(normalized_videos),
        }

    async def get_course_by_slug(self, slug: str) -> dict[str, Any]:
        payload = await self._request("GET", f"/api/courses/slug/{slug}")
        course = payload.get("course") or {}
        normalized_course = self._normalize_course_item(course)
        videos_raw = course.get("videos") or []
        normalized_videos = [
            self._normalize_course_video(item, fallback_order=index)
            for index, item in enumerate(videos_raw)
            if isinstance(item, dict)
        ]
        normalized_videos.sort(key=lambda item: int(item.get("order") or 0))
        return {
            **normalized_course,
            "videos": normalized_videos,
            "total_videos": len(normalized_videos),
        }

    async def get_enrolled_course_detail(self, auth_token: str, course_id: str) -> dict[str, Any]:
        if not auth_token:
            raise ConfigurationError("Enrolled course detail lookup requires a backend auth token.")

        payload = await self._request(
            "GET",
            f"/api/enrollments/course/{course_id}",
            auth_token=auth_token,
        )
        enrollment = payload.get("enrollment") or {}
        course = enrollment.get("courseId") or {}
        videos_raw = course.get("videos") if isinstance(course, dict) else []
        normalized_videos = [
            self._normalize_course_video(item, fallback_order=index)
            for index, item in enumerate(videos_raw or [])
            if isinstance(item, dict)
        ]
        normalized_videos.sort(key=lambda item: int(item.get("order") or 0))

        current_video_id = str(enrollment.get("currentVideoId") or "").strip()
        current_video_index = enrollment.get("currentVideoIndex")
        completed_videos = {
            str(item).strip()
            for item in (enrollment.get("completedVideos") or [])
            if str(item).strip()
        }

        current_video = next(
            (
                item
                for item in normalized_videos
                if current_video_id and str(item.get("id") or "").strip() == current_video_id
            ),
            None,
        )
        if current_video is None and isinstance(current_video_index, int):
            if 0 <= current_video_index < len(normalized_videos):
                current_video = normalized_videos[current_video_index]
        if current_video is None:
            current_video = next(
                (
                    item
                    for item in normalized_videos
                    if str(item.get("id") or "").strip() not in completed_videos
                ),
                None,
            )
        if current_video is None and normalized_videos:
            current_video = normalized_videos[0]

        return {
            "enrollment_id": enrollment.get("_id"),
            "course": {
                **self._normalize_course_item(course if isinstance(course, dict) else {}),
                "total_videos": course.get("totalVideos") if isinstance(course, dict) else None,
                "total_pdfs": course.get("totalPdfs") if isinstance(course, dict) else None,
            },
            "progress": {
                "percentage": enrollment.get("progress"),
                "is_completed": enrollment.get("isCompleted"),
                "completed_at": enrollment.get("completedAt"),
                "completed_videos": list(completed_videos),
                "completed_pdfs": [str(item).strip() for item in (enrollment.get("completedPdfs") or []) if str(item).strip()],
                "current_video_id": current_video_id or None,
                "current_video_index": current_video_index,
                "last_accessed_at": enrollment.get("lastAccessedAt"),
                "enrolled_at": enrollment.get("enrolledAt"),
            },
            "videos": normalized_videos,
            "current_video": current_video,
        }

    async def get_user_subscription(self, auth_token: str) -> dict[str, Any]:
        if not auth_token:
            raise ConfigurationError("Subscription lookup requires a backend auth token.")
        payload = await self._request("GET", "/api/user/subscription", auth_token=auth_token)
        data = payload.get("data", payload)
        return {
            "subscription_plan": data.get("subscriptionPlan") or data.get("plan"),
            "subscription_status": data.get("subscriptionStatus") or data.get("status"),
            "valid_until": data.get("endDate") or data.get("validUntil"),
            "raw": data,
        }

    async def get_support_messages(self, auth_token: str) -> dict[str, Any]:
        if not auth_token:
            raise ConfigurationError("Support lookup requires a backend auth token.")
        payload = await self._request("GET", "/api/support/messages", auth_token=auth_token)
        messages = payload.get("messages") or payload.get("data") or []
        normalized = [
            {
                "id": item.get("_id"),
                "subject": item.get("subject"),
                "status": item.get("status"),
                "created_at": item.get("createdAt"),
                "updated_at": item.get("updatedAt"),
            }
            for item in messages
        ]
        return {"items": normalized, "total": len(normalized)}

    async def get_my_event_registrations(
        self,
        auth_token: str,
        *,
        status: str | None = None,
        upcoming_only: bool = False,
        past_only: bool = False,
    ) -> dict[str, Any]:
        if not auth_token:
            raise ConfigurationError("Event registration lookup requires a backend auth token.")
        params: dict[str, Any] = {}
        if status:
            params["status"] = status
        if upcoming_only:
            params["upcoming"] = "true"
        if past_only:
            params["past"] = "true"

        payload = await self._request(
            "GET",
            "/api/events/my-registrations",
            auth_token=auth_token,
            params=params or None,
        )
        registrations = payload.get("registrations") or []
        normalized = [
            {
                "registration_id": item.get("_id"),
                "status": item.get("status"),
                "payment_status": item.get("paymentStatus"),
                "payment_amount": item.get("paymentAmount"),
                "registered_at": item.get("registeredAt"),
                "event_id": item.get("eventId", {}).get("_id"),
                "event_title": item.get("eventId", {}).get("title"),
                "event_date": item.get("eventId", {}).get("eventDate"),
                "event_time": item.get("eventId", {}).get("eventTime"),
                "event_start_time": item.get("eventId", {}).get("startTime"),
                "event_location": item.get("eventId", {}).get("location"),
                "event_category": item.get("eventId", {}).get("category"),
                "event_status": item.get("eventId", {}).get("status"),
            }
            for item in registrations
            if isinstance(item, dict)
        ]
        return {"items": normalized, "total": len(normalized)}

    async def get_event_detail(self, event_id: str) -> dict[str, Any]:
        payload = await self._request("GET", f"/api/events/{event_id}")
        event = payload.get("event") or {}
        meta = payload.get("meta") or {}
        return {
            "id": event.get("_id"),
            "title": event.get("title"),
            "description": event.get("description") or event.get("shortDescription"),
            "category": event.get("category"),
            "event_date": event.get("eventDate"),
            "event_time": event.get("eventTime"),
            "start_time": event.get("startTime"),
            "end_time": event.get("endTime"),
            "timezone": event.get("timezone"),
            "location": event.get("location"),
            "location_type": event.get("locationType"),
            "online_meeting_link": event.get("onlineMeetingLink"),
            "is_paid": bool(event.get("isPaid")),
            "price": meta.get("currentPrice", event.get("price")),
            "currency": event.get("currency") or "INR",
            "status": event.get("status"),
            "organizer": event.get("organizer"),
            "requirements": event.get("requirements") or [],
            "what_to_bring": event.get("whatToBring") or [],
            "additional_info": event.get("additionalInfo"),
            "registration_required": bool(event.get("registrationRequired")),
            "registration_deadline": event.get("registrationDeadline"),
            "can_register": bool(meta.get("canRegister")),
            "is_full": bool(meta.get("isFull")),
            "spots_left": meta.get("spotsLeft"),
            "tags": event.get("tags") or [],
        }

    async def get_event_registration_status(self, auth_token: str, event_id: str) -> dict[str, Any]:
        if not auth_token:
            raise ConfigurationError("Event registration status lookup requires a backend auth token.")

        payload = await self._request(
            "GET",
            f"/api/events/{event_id}/registration-status",
            auth_token=auth_token,
        )
        registration = payload.get("registration") or {}
        return {
            "is_registered": bool(payload.get("isRegistered")),
            "registration_id": registration.get("_id"),
            "status": registration.get("status"),
            "payment_status": registration.get("paymentStatus"),
            "payment_amount": registration.get("paymentAmount"),
            "ticket_id": registration.get("ticketId"),
            "participant_name": registration.get("participantName"),
            "participant_phone": registration.get("participantPhone"),
        }

    async def register_for_event(
        self,
        auth_token: str,
        event_id: str,
        *,
        name: str | None = None,
        email: str | None = None,
        phone: str | None = None,
        notes: str | None = None,
    ) -> dict[str, Any]:
        if not auth_token:
            raise ConfigurationError("Event registration requires a backend auth token.")

        payload = await self._request(
            "POST",
            f"/api/events/{event_id}/register",
            auth_token=auth_token,
            json_body={
                "name": name,
                "email": email,
                "phone": phone,
                "notes": notes,
            },
        )

        registration = payload.get("registration") or {}
        event = payload.get("event") or {}
        return {
            "registration_id": registration.get("_id"),
            "status": registration.get("status"),
            "payment_status": registration.get("paymentStatus"),
            "payment_amount": payload.get("paymentAmount"),
            "payment_required": bool(payload.get("paymentRequired")),
            "event": {
                "id": event.get("_id"),
                "title": event.get("title"),
                "event_date": event.get("eventDate"),
                "event_time": event.get("eventTime"),
                "location": event.get("location"),
            },
            "message": payload.get("message"),
        }

    async def cancel_event_registration(self, auth_token: str, event_id: str) -> dict[str, Any]:
        if not auth_token:
            raise ConfigurationError("Event registration cancellation requires a backend auth token.")

        payload = await self._request(
            "DELETE",
            f"/api/events/{event_id}/register",
            auth_token=auth_token,
        )
        registration = payload.get("registration") or {}
        return {
            "registration_id": registration.get("_id"),
            "status": registration.get("status") or "cancelled",
            "message": payload.get("message") or "Registration cancelled successfully.",
        }

    async def create_event_registration_link(
        self,
        auth_token: str,
        event_id: str,
        *,
        name: str | None = None,
        email: str | None = None,
        phone: str | None = None,
        notes: str | None = None,
    ) -> dict[str, Any]:
        if not auth_token:
            raise ConfigurationError("Paid event registration requires a backend auth token.")

        payload = await self._request(
            "POST",
            f"/api/events/{event_id}/register/link",
            auth_token=auth_token,
            json_body={
                "name": name,
                "email": email,
                "phone": phone,
                "notes": notes,
            },
        )

        data = payload.get("data") or {}
        return {
            "payment_url": data.get("url"),
            "payment_link_id": data.get("paymentLinkId"),
            "registration_id": data.get("registrationId"),
            "is_test_mode": bool(data.get("isTestMode")),
            "payment_amount": data.get("paymentAmount"),
            "event": data.get("event") or {},
        }

    async def enroll_in_course(self, auth_token: str, course_id: str) -> dict[str, Any]:
        if not auth_token:
            raise ConfigurationError("Course enrollment requires a backend auth token.")

        payload = await self._request(
            "POST",
            "/api/enrollments/enroll",
            auth_token=auth_token,
            json_body={"courseId": course_id},
        )
        enrollment = payload.get("enrollment") or {}
        course = payload.get("course") or {}
        return {
            "enrollment_id": enrollment.get("_id"),
            "status": "enrolled",
            "course": {
                "id": course.get("_id"),
                "title": course.get("title"),
                "total_videos": course.get("totalVideos"),
                "total_pdfs": course.get("totalPdfs"),
            },
            "message": payload.get("message") or "Successfully enrolled in the course.",
        }

    async def complete_course(self, auth_token: str, course_id: str) -> dict[str, Any]:
        if not auth_token:
            raise ConfigurationError("Marking course as complete requires a backend auth token.")

        payload = await self._request(
            "POST",
            f"/api/enrollments/course/{course_id}/complete",
            auth_token=auth_token,
        )
        return {
            "success": bool(payload.get("success")),
            "message": payload.get("message") or "Successfully marked the course as completed.",
            "progress": payload.get("progress"),
            "is_completed": bool(payload.get("isCompleted")),
            "completed_videos_count": payload.get("completedVideosCount"),
            "completed_pdfs_count": payload.get("completedPdfsCount"),
        }

    async def get_course_enrollment_status(self, auth_token: str, course_id: str) -> dict[str, Any]:
        if not auth_token:
            raise ConfigurationError("Course enrollment status requires a backend auth token.")

        payload = await self._request(
            "GET",
            f"/api/enrollments/check/{course_id}",
            auth_token=auth_token,
        )
        enrollment = payload.get("enrollment") or {}
        return {
            "is_enrolled": bool(payload.get("isEnrolled")),
            "enrollment_id": enrollment.get("_id"),
            "progress": enrollment.get("progress"),
            "status": enrollment.get("status"),
            "is_completed": enrollment.get("isCompleted"),
            "current_video_id": enrollment.get("currentVideoId"),
            "current_video_index": enrollment.get("currentVideoIndex"),
            "last_accessed_at": enrollment.get("lastAccessedAt"),
        }

    async def create_membership_payment_link(
        self,
        auth_token: str,
        plan: str,
        *,
        variant_slug: str | None = None,
    ) -> dict[str, Any]:
        if not auth_token:
            raise ConfigurationError("Membership purchase requires a backend auth token.")

        payload = await self._request(
            "POST",
            "/api/payments/membership-link",
            auth_token=auth_token,
            json_body={
                "plan": plan,
                "variantSlug": variant_slug,
            },
        )
        data = payload.get("data") or {}
        return {
            "payment_url": data.get("url"),
            "payment_link_id": data.get("paymentLinkId"),
            "test_mode": bool(data.get("testMode")),
            "message": payload.get("message") or "Payment link created.",
        }

    # ──────────────────────────────────────────────────────────────────────
    # Counseling
    # ──────────────────────────────────────────────────────────────────────

    @staticmethod
    def _normalize_counseling_service(item: dict[str, Any]) -> dict[str, Any]:
        """Normalize a raw counselingService document into a clean AI-facing payload."""
        return {
            "id": str(item.get("_id") or "").strip(),
            "title": item.get("title"),
            "description": item.get("description"),
            "icon": item.get("icon") or "help-buoy",
            "color": item.get("color") or "#3B82F6",
            "bg_color": item.get("bgColor") or "#EFF6FF",
            "duration": item.get("duration") or "60 mins",
            "price": item.get("price") if item.get("price") is not None else 0,
            "is_free": bool(item.get("isFree") or (item.get("price") == 0)),
            "counselor_name": item.get("counselorName") or "Expert Counselor",
            "interval_minutes": item.get("intervalMinutes") or 60,
            "is_active": bool(item.get("isActive", True)),
            "calendly_enabled": bool((item.get("calendlyIntegration") or {}).get("isEnabled")),
            "calendly_url": (item.get("calendlyIntegration") or {}).get("eventUri") or None,
        }

    async def get_counseling_services(self) -> dict[str, Any]:
        """Fetch all active counseling services from the public endpoint."""
        payload = await self._request("GET", "/api/counseling/services")
        raw_services = (payload.get("data") or {}).get("services") or []
        normalized = [
            self._normalize_counseling_service(item)
            for item in raw_services
            if isinstance(item, dict) and item.get("isActive", True)
        ]
        return {
            "items": normalized,
            "total": len(normalized),
        }

    async def get_counselor_availability(
        self,
        date: str,
        counselor_type: str | None = None,
        auth_token: str | None = None,
    ) -> dict[str, Any]:
        """Fetch available booking slots for a given date and optional counselor type.

        Args:
            date: ISO date string in YYYY-MM-DD format.
            counselor_type: Optional counseling service title (e.g. 'Spiritual Morning Guidance').
            auth_token: Optional user auth token; the endpoint is public, so this is ignored.
        """
        params: dict[str, str] = {"date": date}
        if counselor_type:
            params["counselorType"] = counselor_type

        payload = await self._request("GET", "/api/counseling/availability", params=params)

        raw_data = payload.get("data") or {}
        slots = raw_data.get("availableSlots") or []
        # Normalize: ensure every slot is a clean string
        normalized_slots = [str(s).strip() for s in slots if s and str(s).strip()]

        return {
            "date": raw_data.get("date") or date,
            "counselor_type": raw_data.get("counselorType") or counselor_type,
            "slots": normalized_slots,
            "total_slots": len(normalized_slots),
        }

    def _normalize_counseling_booking(self, item: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": str(item.get("_id") or ""),
            "counselor_type": item.get("counselorType"),
            "counselor_name": item.get("counselorName") or "Expert Counselor",
            "booking_type": item.get("bookingType"),
            "booking_title": item.get("bookingTitle"),
            "booking_date": item.get("bookingDate"),
            "booking_time": item.get("bookingTime"),
            "status": item.get("status") or "pending",
            "is_free": bool(item.get("isFree", True)),
            "amount": float(item.get("amount") or 0.0),
            "payment_status": item.get("paymentStatus") or "pending",
            "meeting_link": item.get("meetingLink") or None,
            "created_at": item.get("createdAt"),
        }

    async def get_my_counseling_bookings(
        self,
        status: str | None = None,
        upcoming: bool = False,
        auth_token: str | None = None,
    ) -> dict[str, Any]:
        """Fetch the authenticated user's booked appointments."""
        params: dict[str, str] = {}
        if status:
            params["status"] = status
        if upcoming:
            params["upcoming"] = "true"

        payload = await self._request("GET", "/api/counseling/my-bookings", params=params, auth_token=auth_token)
        raw_bookings = (payload.get("data") or {}).get("bookings") or []
        normalized = [
            self._normalize_counseling_booking(item)
            for item in raw_bookings
            if isinstance(item, dict)
        ]
        return {
            "items": normalized,
            "total": len(normalized),
        }

    async def book_counseling_session(
        self,
        counselor_type: str,
        booking_date: str,
        booking_time: str,
        user_notes: str | None = None,
        auth_token: str | None = None,
    ) -> dict[str, Any]:
        """Book a slot for a counseling service."""
        body = {
            "counselorType": counselor_type,
            "bookingDate": booking_date,
            "bookingTime": booking_time,
            "userNotes": user_notes or "",
        }
        # Resolve service details to get the canonical title and server-side price.
        # The backend validates that req.body.amount matches the service price, so we must pass it.
        services_response = await self.get_counseling_services()
        services = services_response.get("items") or []
        service = next(
            (s for s in services if s["title"].lower() == counselor_type.lower() or s["id"] == counselor_type),
            None
        )
        amount = 0.0
        if service:
            amount = service["price"]
            counselor_type = service["title"]  # Use canonical title from server

        body["amount"] = amount

        payload = await self._request("POST", "/api/counseling/book", json_body=body, auth_token=auth_token)
        booking = (payload.get("data") or {}).get("booking") or {}
        return {
            "success": True,
            "message": payload.get("message") or "Counseling session booked successfully",
            "booking": self._normalize_counseling_booking(booking) if booking else None,
        }

    async def cancel_counseling_booking(
        self,
        booking_id: str,
        reason: str | None = None,
        auth_token: str | None = None,
    ) -> dict[str, Any]:
        """Cancel an upcoming appointment with slot refunding."""
        body = {"reason": reason or "User requested cancellation"}
        payload = await self._request("PATCH", f"/api/counseling/{booking_id}/cancel", json_body=body, auth_token=auth_token)
        return {
            "success": True,
            "message": payload.get("message") or "Booking cancelled successfully",
        }

    async def create_booking_payment_link(
        self,
        booking_id: str,
        auth_token: str | None = None,
    ) -> dict[str, Any]:
        """Create Razorpay hosted checkout payment link for a counseling booking."""
        body = {"bookingId": booking_id}
        payload = await self._request("POST", "/api/payments/booking-link", json_body=body, auth_token=auth_token)
        data = payload.get("data") or {}
        return {
            "url": data.get("url"),
            "payment_link_id": data.get("paymentLinkId"),
        }

    async def confirm_booking_payment_link(
        self,
        payment_link_id: str,
        booking_id: str,
        auth_token: str | None = None,
    ) -> dict[str, Any]:
        """Confirm a counseling booking payment status and activate booking."""
        body = {
            "paymentLinkId": payment_link_id,
            "bookingId": booking_id,
        }
        payload = await self._request("POST", "/api/payments/booking-link/confirm", json_body=body, auth_token=auth_token)
        return {
            "success": bool(payload.get("success")),
            "message": payload.get("message") or "Payment verified",
            "status": (payload.get("data") or {}).get("status"),
        }

    def _normalize_product(self, item: dict[str, Any]) -> dict[str, Any]:
        pricing = item.get("pricing") or {}
        rating = item.get("rating") or {}
        inventory = item.get("inventory") or {}
        shop = item.get("shop") or {}
        category = item.get("category") or {}
        
        # Resolve images
        images = item.get("images") or []
        image_url = ""
        if images and isinstance(images, list):
            primary = next((img for img in images if isinstance(img, dict) and img.get("isPrimary")), None)
            if primary:
                image_url = primary.get("url") or ""
            elif len(images) > 0 and isinstance(images[0], dict):
                image_url = images[0].get("url") or ""
        elif isinstance(item.get("image"), str):
            image_url = item.get("image") or ""
        
        # Check stock status
        stock = int(inventory.get("stock") or 0)
        is_out_of_stock = not bool(inventory.get("isUnlimited", False)) and stock <= 0

        return {
            "id": str(item.get("_id") or ""),
            "name": str(item.get("name") or ""),
            "description": str(item.get("description") or item.get("shortDescription") or ""),
            "price": float(pricing.get("sellingPrice") or 0.0),
            "mrp": float(pricing.get("mrp") or 0.0),
            "image": image_url,
            "shop_name": shop.get("name") or "ParamSukh Shop",
            "category_name": category.get("name") or "General",
            "is_out_of_stock": is_out_of_stock,
            "rating": float(rating.get("average") or 0.0),
            "rating_count": int(rating.get("count") or 0),
        }

    async def search_products(
        self,
        query: str | None = None,
        category: str | None = None,
        min_price: float | None = None,
        max_price: float | None = None,
        in_stock: bool | None = None,
        rating: float | None = None,
        limit: int = 20,
    ) -> dict[str, Any]:
        """Query the product catalog with filters."""
        params: dict[str, str] = {
            "limit": str(limit),
        }
        if query:
            params["search"] = query
        if category:
            params["category"] = category
        if min_price is not None:
            params["minPrice"] = str(min_price)
        if max_price is not None:
            params["maxPrice"] = str(max_price)
        if in_stock is not None:
            params["inStock"] = "true" if in_stock else "false"
        if rating is not None:
            params["rating"] = str(rating)

        payload = await self._request("GET", "/api/products", params=params)
        raw_products = (payload.get("data") or {}).get("products") or []
        normalized = [
            self._normalize_product(item)
            for item in raw_products
            if isinstance(item, dict)
        ]
        return {
            "items": normalized,
            "total": len(normalized),
        }

    @staticmethod
    def _normalize_address(item: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": str(item.get("_id") or ""),
            "type": str(item.get("type") or "home"),
            "fullName": str(item.get("fullName") or ""),
            "phone": str(item.get("phone") or ""),
            "addressLine1": str(item.get("addressLine1") or ""),
            "addressLine2": str(item.get("addressLine2") or ""),
            "landmark": str(item.get("landmark") or ""),
            "city": str(item.get("city") or ""),
            "state": str(item.get("state") or ""),
            "pincode": str(item.get("pincode") or ""),
            "country": str(item.get("country") or "India"),
            "isDefault": bool(item.get("isDefault", False)),
        }

    async def get_addresses(self, auth_token: str) -> dict[str, Any]:
        """Fetch user delivery addresses."""
        if not auth_token:
            raise ToolExecutionError("get_addresses", "Authentication is required to retrieve saved addresses.")
        payload = await self._request("GET", "/api/addresses", auth_token=auth_token)
        raw_addresses = (payload.get("data") or {}).get("addresses") or []
        normalized = [
            self._normalize_address(item)
            for item in raw_addresses
            if isinstance(item, dict)
        ]
        return {
            "items": normalized,
            "total": len(normalized),
        }

    async def clear_cart(self, auth_token: str) -> dict[str, Any]:
        """Clear user cart."""
        if not auth_token:
            raise ToolExecutionError("clear_cart", "Authentication is required to modify the cart.")
        return await self._request("DELETE", "/api/cart/clear", auth_token=auth_token)

    async def add_to_cart(
        self,
        auth_token: str,
        product_id: str,
        quantity: int = 1,
        variant: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Add product to user cart."""
        if not auth_token:
            raise ToolExecutionError("add_to_cart", "Authentication is required to modify the cart.")
        body = {
            "productId": product_id,
            "quantity": quantity,
        }
        if variant:
            body["variant"] = variant
        return await self._request("POST", "/api/cart/add", json_body=body, auth_token=auth_token)

    async def create_order(
        self,
        auth_token: str,
        address_id: str,
        payment_method: str,
        customer_notes: str | None = None,
    ) -> dict[str, Any]:
        """Create order from cart contents."""
        if not auth_token:
            raise ToolExecutionError("create_order", "Authentication is required to create an order.")
        body = {
            "addressId": address_id,
            "paymentMethod": payment_method,
        }
        if customer_notes is not None:
            body["customerNotes"] = customer_notes
        return await self._request("POST", "/api/orders/create", json_body=body, auth_token=auth_token)

    async def create_payment_link(self, auth_token: str, order_id: str) -> dict[str, Any]:
        """Generate Razorpay payment link for an order."""
        if not auth_token:
            raise ToolExecutionError("create_payment_link", "Authentication is required to initiate payment.")
        return await self._request("POST", f"/api/orders/{order_id}/payment-link", auth_token=auth_token)

    @staticmethod
    def _normalize_order(item: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": str(item.get("_id") or ""),
            "orderNumber": str(item.get("orderNumber") or ""),
            "status": str(item.get("status") or "pending"),
            "items": item.get("items") or [],
            "deliveryAddress": item.get("deliveryAddress") or {},
            "pricing": item.get("pricing") or {},
            "payment": item.get("payment") or {},
            "createdAt": str(item.get("createdAt") or ""),
        }

    async def get_my_orders(self, auth_token: str) -> dict[str, Any]:
        """Fetch user order history."""
        if not auth_token:
            raise ToolExecutionError("get_my_orders", "Authentication is required to view order history.")
        payload = await self._request("GET", "/api/orders/my-orders", auth_token=auth_token)
        raw_orders = (payload.get("data") or {}).get("orders") or []
        normalized = [
            self._normalize_order(item)
            for item in raw_orders
            if isinstance(item, dict)
        ]
        return {
            "items": normalized,
            "total": len(normalized),
        }

    async def cancel_order(self, auth_token: str, order_id: str, reason: str | None = None) -> dict[str, Any]:
        """Cancel an order."""
        if not auth_token:
            raise ToolExecutionError("cancel_order", "Authentication is required to cancel an order.")
        body = {}
        if reason:
            body["reason"] = reason
        return await self._request("PATCH", f"/api/orders/{order_id}/cancel", json_body=body, auth_token=auth_token)

    async def add_address(
        self,
        auth_token: str,
        full_name: str,
        phone: str,
        address_line1: str,
        city: str,
        state: str,
        pincode: str,
        address_type: str = "home",
        address_line2: str | None = None,
        landmark: str | None = None,
    ) -> dict[str, Any]:
        """Add a new delivery address for the user."""
        if not auth_token:
            raise ToolExecutionError("add_address", "Authentication is required to add an address.")
        body = {
            "type": address_type,
            "fullName": full_name,
            "phone": phone,
            "addressLine1": address_line1,
            "city": city,
            "state": state,
            "pincode": pincode,
        }
        if address_line2:
            body["addressLine2"] = address_line2
        if landmark:
            body["landmark"] = landmark

        payload = await self._request("POST", "/api/addresses/add", json_body=body, auth_token=auth_token)
        raw_address = (payload.get("data") or {}).get("address") or {}
        return self._normalize_address(raw_address)

    async def confirm_order_payment(self, auth_token: str, order_id: str, payment_link_id: str) -> dict[str, Any]:
        """Verify payment link status and mark the order paid and confirmed in backend."""
        if not auth_token:
            raise ToolExecutionError("confirm_order_payment", "Authentication is required to confirm payment.")
        body = {
            "orderId": order_id,
            "paymentLinkId": payment_link_id,
        }
        return await self._request("POST", "/api/orders/confirm-payment-link", json_body=body, auth_token=auth_token)

    async def get_my_groups(self, auth_token: str) -> dict[str, Any]:
        """Fetch user's hierarchical/flat community groups."""
        if not auth_token:
            raise ToolExecutionError("get_community_groups", "Authentication is required to retrieve community groups.")
        payload = await self._request("GET", "/api/community/my-groups", auth_token=auth_token)
        # Normalize groups
        plan_groups = payload.get("planGroups", [])
        flat_groups = payload.get("groups", [])
        other_groups = payload.get("otherGroups", [])
        return {
            "plan_groups": plan_groups,
            "groups": flat_groups,
            "other_groups": other_groups,
            "total": payload.get("totalGroups", len(flat_groups))
        }

    async def get_group_posts(self, auth_token: str, group_id: str, page: int = 1) -> dict[str, Any]:
        """Fetch discussion posts inside a community group."""
        if not auth_token:
            raise ToolExecutionError("get_community_posts", "Authentication is required to fetch posts.")
        params = {"page": page, "limit": 20}
        payload = await self._request("GET", f"/api/community/groups/{group_id}/posts", params=params, auth_token=auth_token)
        return {
            "posts": payload.get("posts", []),
            "is_combined": payload.get("isCombinedFeed", False),
            "pagination": payload.get("pagination") or {}
        }

    async def create_post(self, auth_token: str, group_id: str, content: str, tags: list[str] = None) -> dict[str, Any]:
        """Publish a new post inside a community group."""
        if not auth_token:
            raise ToolExecutionError("create_community_post", "Authentication is required to create a post.")
        body = {"content": content}
        if tags:
            body["tags"] = tags
        payload = await self._request("POST", f"/api/community/groups/{group_id}/posts", json_body=body, auth_token=auth_token)
        return payload.get("data") or payload

    async def get_post_comments(self, auth_token: str, post_id: str) -> dict[str, Any]:
        """Fetch comments for a specific post."""
        if not auth_token:
            raise ToolExecutionError("get_post_comments", "Authentication is required to fetch comments.")
        payload = await self._request("GET", f"/api/community/posts/{post_id}/comments", auth_token=auth_token)
        return {
            "comments": payload.get("comments") or payload.get("data", {}).get("comments") or [],
            "total_comments": payload.get("totalComments") or payload.get("data", {}).get("totalComments") or 0,
        }

    async def create_comment(
        self,
        auth_token: str,
        post_id: str,
        content: str,
        parent_comment_id: str | None = None,
    ) -> dict[str, Any]:
        """Add a comment/reply to a community post."""
        if not auth_token:
            raise ToolExecutionError("create_post_comment", "Authentication is required to comment.")
        body = {"content": content}
        if parent_comment_id:
            body["parentCommentId"] = parent_comment_id
        payload = await self._request("POST", f"/api/community/posts/{post_id}/comments", json_body=body, auth_token=auth_token)
        return payload.get("data") or payload

    async def toggle_post_like(self, auth_token: str, post_id: str) -> dict[str, Any]:
        """Toggle post like status."""
        if not auth_token:
            raise ToolExecutionError("like_community_post", "Authentication is required to like a post.")
        return await self._request("POST", f"/api/community/posts/{post_id}/like", auth_token=auth_token)




