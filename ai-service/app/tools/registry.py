from typing import Any

from app.models.chat import ChatRequest
from app.tools.action_tools.courses import EnrollInCourseTool, PlayCurrentLessonTool, CompleteCourseTool
from app.tools.action_tools.events import CancelEventRegistrationTool, RegisterForEventTool
from app.tools.action_tools.memberships import StartMembershipPurchaseTool
from app.tools.action_tools.counseling import BookCounselingSessionTool, CancelCounselingBookingTool
from app.tools.action_tools.podcasts import PlayPodcastTool
from app.tools.action_tools.community import (
    CreateCommunityPostTool,
    CreatePostCommentTool,
    LikeCommunityPostTool,
    ReplyToPostCommentTool,
)
from app.tools.information_tools.courses import CompareCoursesTool, RecommendCoursesTool, SearchCoursesTool, GetCourseDetailsTool
from app.tools.information_tools.enrollments import GetContinueLearningTool, GetCourseProgressTool, GetMyEnrollmentsTool
from app.tools.information_tools.events import (
    CompareEventsTool,
    GetEventDetailsTool,
    GetMyEventRegistrationsTool,
    SearchEventsTool,
)
from app.tools.information_tools.memberships import GetMembershipPlansTool, GetMySubscriptionTool
from app.tools.information_tools.podcasts import SearchPodcastsTool
from app.tools.information_tools.support import GetSupportMessagesTool, SearchSupportContentTool
from app.tools.information_tools.counseling import SearchCounselingServicesTool, CheckCounselorAvailabilityTool, GetMyCounselingBookingsTool
from app.tools.information_tools.guidance import GetDailyGuidanceTool
from app.tools.information_tools.shop import SearchProductsTool, GetSavedAddressesTool, GetMyOrdersTool
from app.tools.action_tools.shop import PlaceProductOrderTool, CancelOrderTool, AddAddressTool, ConfirmOrderPaymentTool, RequestAddressFormTool
from app.tools.information_tools.community import GetCommunityGroupsTool, GetCommunityPostsTool, GetPostCommentsTool


class ToolRegistry:
    def __init__(self) -> None:
        self.tools = {
            "search_courses": SearchCoursesTool(),
            "recommend_courses": RecommendCoursesTool(),
            "compare_courses": CompareCoursesTool(),
            "get_course_details": GetCourseDetailsTool(),
            "search_events": SearchEventsTool(),
            "compare_events": CompareEventsTool(),
            "get_event_details": GetEventDetailsTool(),
            "register_for_event": RegisterForEventTool(),
            "cancel_event_registration": CancelEventRegistrationTool(),
            "enroll_in_course": EnrollInCourseTool(),
            "play_current_lesson": PlayCurrentLessonTool(),
            "complete_course": CompleteCourseTool(),
            "start_membership_purchase": StartMembershipPurchaseTool(),
            "search_podcasts": SearchPodcastsTool(),
            "get_membership_plans": GetMembershipPlansTool(),
            "get_my_subscription": GetMySubscriptionTool(),
            "get_my_enrollments": GetMyEnrollmentsTool(),
            "get_continue_learning": GetContinueLearningTool(),
            "get_course_progress": GetCourseProgressTool(),
            "get_my_event_registrations": GetMyEventRegistrationsTool(),
            "search_support_content": SearchSupportContentTool(),
            "get_support_messages": GetSupportMessagesTool(),
            "search_counseling_services": SearchCounselingServicesTool(),
            "check_counselor_availability": CheckCounselorAvailabilityTool(),
            "get_my_counseling_bookings": GetMyCounselingBookingsTool(),
            "book_counseling_session": BookCounselingSessionTool(),
            "cancel_counseling_booking": CancelCounselingBookingTool(),
            "play_podcast": PlayPodcastTool(),
            "create_community_post": CreateCommunityPostTool(),
            "create_post_comment": CreatePostCommentTool(),
            "like_community_post": LikeCommunityPostTool(),
            "reply_to_post_comment": ReplyToPostCommentTool(),
            "get_daily_guidance": GetDailyGuidanceTool(),
            "search_products": SearchProductsTool(),
            "get_saved_addresses": GetSavedAddressesTool(),
            "get_my_orders": GetMyOrdersTool(),
            "place_product_order": PlaceProductOrderTool(),
            "cancel_order": CancelOrderTool(),
            "add_address": AddAddressTool(),
            "confirm_order_payment": ConfirmOrderPaymentTool(),
            "request_address_form": RequestAddressFormTool(),
            "get_community_groups": GetCommunityGroupsTool(),
            "get_community_posts": GetCommunityPostsTool(),
            "get_post_comments": GetPostCommentsTool(),
        }

    def get_tool_schemas(self) -> list[dict[str, Any]]:
        return [tool.schema() for tool in self.tools.values()]

    async def execute(self, tool_name: str, arguments: dict[str, Any], payload: ChatRequest) -> dict[str, Any]:
        tool = self.tools.get(tool_name)
        if tool is None:
            return {"success": False, "message": f"Unknown tool: {tool_name}"}
        return await tool.execute(arguments, payload)

