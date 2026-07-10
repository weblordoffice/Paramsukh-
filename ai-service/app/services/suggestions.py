from typing import Any

from app.models.chat import ChatRequest, SuggestedAction, ToolExecution


def generate_status_text(tool_name: str) -> str:
    status_map = {
        "search_courses": "Connecting to the Course Directory to scan available catalog items...",
        "recommend_courses": "Querying the Recommendation Engine to personalize your study recommendations...",
        "compare_courses": "Comparing syllabus, ratings, and course parameters side-by-side...",
        "get_course_details": "Accessing the Course Details module to fetch syllabus and lessons list...",
        "get_my_enrollments": "Connecting to your Personal Learning Ledger to summarize active enrollments...",
        "get_course_progress": "Calculating completion percentages and milestones from your progress history...",
        "get_continue_learning": "Retrieving your last-watched lesson markers to resume playback...",
        "search_events": "Searching the Live Events Database to fetch upcoming sessions...",
        "compare_events": "Analyzing dates, pricing tiers, and locations for comparison...",
        "get_event_details": "Fetching detailed agenda, speaker list, and event requirements...",
        "get_my_event_registrations": "Retrieving your event booking history and reservation status...",
        "get_membership_plans": "Querying the Membership Registry to fetch available subscription tiers...",
        "get_my_subscription": "Verifying your active plan credentials and membership validation...",
        "search_podcasts": "Scanning the Audio Archives for relevant spiritual discourse tracks...",
        "search_support_content": "Searching the Knowledge Base index to locate matching articles...",
        "get_support_messages": "Accessing the Support Dispatcher to fetch help ticket updates...",
        "register_for_event": "Contacting the Booking Gateway to process event registration...",
        "cancel_event_registration": "Requesting cancellation of your event reservation ticket...",
        "enroll_in_course": "Accessing the Enrollment Registrar to initialize your course access...",
        "play_current_lesson": "Retrieving video streaming credentials to prepare your lesson...",
        "complete_course": "Updating your learning ledger to mark the course completed...",
        "start_membership_purchase": "Initializing payment processing gateway for plan selection...",
        "search_counseling_services": "Connecting to Counseling Directory to retrieve active counselor specializations...",
        "check_counselor_availability": "Accessing the clinical calendar to check available booking slots...",
        "get_my_counseling_bookings": "Retrieving your booked appointments and counseling schedule...",
        "book_counseling_session": "Booking slot and checking scheduling confirmation...",
        "cancel_counseling_booking": "Contacting scheduling system to cancel session booking...",
        "play_podcast": "Preparing audio stream and verifying access credentials for podcast...",
        "get_daily_guidance": "Consulting spiritual guidance indexes and charts for your daily wisdom...",
        "search_products": "Scanning the ParamSukh shop for matching spiritual products...",
        "get_saved_addresses": "Accessing your profile to retrieve saved shipping addresses...",
        "get_my_orders": "Accessing your Order Ledger to fetch recent purchases...",
        "place_product_order": "Preparing shopping cart and checking shipping address...",
        "cancel_order": "Contacting dispatch center to cancel your order...",
    }
    return status_map.get(tool_name, "Consulting internal tools...")


def generate_follow_up(tool_history: list[ToolExecution], answer: str, payload: ChatRequest) -> str | None:
    if not tool_history:
        return None
    
    # Just take the first successful tool for a hint
    primary_tool = next((t for t in tool_history if t.success), None)
    if not primary_tool:
        return None
        
    tool_name = primary_tool.tool_name
    result = primary_tool.result or {}
    data = result.get("data") if isinstance(result.get("data"), dict) else {}
    
    explicit_follow_up = data.get("follow_up")
    if explicit_follow_up and isinstance(explicit_follow_up, str):
        return explicit_follow_up.strip()

    follow_up_map = {
        "search_courses": "If you want, I can narrow these down by topic, beginner level, or membership access.",
        "recommend_courses": "If you want, I can compare the strongest options or help you enroll in one.",
        "compare_courses": "If you want, I can also show your enrolled courses, detailed progress, or what to continue next.",
        "get_course_details": "If you want, I can help you enroll in this course, show your progress, or compare it with other options.",
        "get_my_enrollments": "If you want, I can also show only your active courses, only completed ones, or the progress for one course.",
        "get_continue_learning": "If you want, I can also open your current lesson, show your full enrolled courses, or compare what to finish next.",
        "get_course_progress": "If you want, I can also open the current lesson or show the rest of your learning progress.",
        "enroll_in_course": "If you want, I can also open the current lesson, show your progress, or help with your other courses.",
        "play_current_lesson": "If you want, I can also show your enrolled courses, your course progress, or help you choose what to continue next.",
        "complete_course": "If you want, I can also show your other enrolled courses or suggest new ones to start next.",
        "search_events": "If you want, I can also filter these by free versus paid, compare a few, or help you register.",
        "compare_events": "If you want, I can also help you register for one of these or show more similar events.",
        "get_event_details": "If you want, I can also help you register, compare it with another event, or show more upcoming options.",
        "register_for_event": "If you want, I can also show your bookings, event details, or other upcoming events.",
        "cancel_event_registration": "If you want, I can also show your current bookings or help you find another event.",
        "get_membership_plans": "If you want, I can also compare the plans or start the purchase flow for one.",
        "start_membership_purchase": "After that, I can help you check your plan status or continue with course access.",
        "search_podcasts": "If you want, I can also narrow these down by category or based on your interests.",
        "search_support_content": "If you want, I can also help with the next app step or show the most relevant support option.",
        "get_support_messages": "If you want, I can also help you understand the latest update or suggest the next step.",
        "search_counseling_services": "If you want, I can check slot availability for a specific service or show you how to book a session.",
        "check_counselor_availability": "If you want, I can also book one of these slots or show all available counseling services.",
        "get_my_counseling_bookings": "If you want, I can check slots for another service or cancel one of your bookings.",
        "book_counseling_session": "You can check your bookings or book another slot if needed.",
        "cancel_counseling_booking": "I can help you find a different time slot or service.",
        "play_podcast": "You can listen to other related audio guides or podcasts in the library.",
        "get_daily_guidance": "If you want, I can also show you spiritual podcasts or recommend a meditation course.",
        "search_products": "If you want, I can filter these products by price, rating, or show you how to order one.",
        "get_saved_addresses": "If you want, I can help you select an address or place your order.",
        "get_my_orders": "If you want, I can track one of your orders or cancel a pending one.",
        "place_product_order": "I can help you check your order history or track your delivery.",
        "cancel_order": "I can show your other orders or help you search the shop catalog.",
    }
    return follow_up_map.get(tool_name)


def generate_suggested_actions(tool_history: list[ToolExecution], payload: ChatRequest) -> list[SuggestedAction]:
    if not tool_history:
        return [
            SuggestedAction(label="Browse Courses", action_type="send_message", action_payload={"message": "Show me available courses"}),
            SuggestedAction(label="My Learning", action_type="send_message", action_payload={"message": "Show my enrolled courses"}),
            SuggestedAction(label="Upcoming Events", action_type="send_message", action_payload={"message": "Show upcoming events"}),
        ]
        
    primary_tool = next((t for t in tool_history if t.success), None)
    if not primary_tool:
        return []
        
    tool_name = primary_tool.tool_name
    
    if tool_name in ["search_courses", "recommend_courses"]:
        return [
            SuggestedAction(label="Beginner Courses", action_type="send_message", action_payload={"message": "Show beginner courses"}),
            SuggestedAction(label="My Enrollments", action_type="send_message", action_payload={"message": "Show my enrolled courses"}),
            SuggestedAction(label="Compare Top 2", action_type="send_message", action_payload={"message": "Compare the top 2 courses"}),
        ]
    elif tool_name in ["get_course_details"]:
        return [
            SuggestedAction(label="Enroll in Course", action_type="send_message", action_payload={"message": "Enroll me in this course"}),
            SuggestedAction(label="Compare Courses", action_type="send_message", action_payload={"message": "Compare this course with others"}),
        ]
    elif tool_name in ["get_my_enrollments", "get_course_progress", "get_continue_learning", "complete_course"]:
        return [
            SuggestedAction(label="Continue Learning", action_type="send_message", action_payload={"message": "What should I continue next?"}),
            SuggestedAction(label="Find New Courses", action_type="send_message", action_payload={"message": "Show me new courses to learn"}),
        ]
    elif tool_name in ["search_events", "compare_events", "get_event_details"]:
        return [
            SuggestedAction(label="Free Events", action_type="send_message", action_payload={"message": "Show free events"}),
            SuggestedAction(label="My Registrations", action_type="send_message", action_payload={"message": "Show my event registrations"}),
        ]
    elif tool_name in ["register_for_event", "cancel_event_registration", "get_my_event_registrations"]:
        return [
            SuggestedAction(label="Upcoming Events", action_type="send_message", action_payload={"message": "Show upcoming events"}),
            SuggestedAction(label="My Courses", action_type="send_message", action_payload={"message": "Show my enrolled courses"}),
        ]
    elif tool_name in ["get_membership_plans", "start_membership_purchase"]:
        return [
            SuggestedAction(label="Compare Plans", action_type="send_message", action_payload={"message": "Compare the membership plans"}),
            SuggestedAction(label="My Subscription", action_type="send_message", action_payload={"message": "Check my subscription status"}),
        ]
        
    elif tool_name in ["search_counseling_services"]:
        return [
            SuggestedAction(label="Check Availability", action_type="send_message", action_payload={"message": "Check counseling availability for this week"}),
            SuggestedAction(label="My Bookings", action_type="send_message", action_payload={"message": "Show my counseling bookings"}),
        ]
    elif tool_name in ["check_counselor_availability"]:
        return [
            SuggestedAction(label="Book a Session", action_type="send_message", action_payload={"message": "Book a counseling session"}),
            SuggestedAction(label="Browse Services", action_type="send_message", action_payload={"message": "Show all counseling services"}),
        ]
    elif tool_name in ["get_my_counseling_bookings", "cancel_counseling_booking"]:
        return [
            SuggestedAction(label="Book a Session", action_type="send_message", action_payload={"message": "Book a counseling session"}),
            SuggestedAction(label="Browse Services", action_type="send_message", action_payload={"message": "Show all counseling services"}),
        ]
    elif tool_name in ["book_counseling_session"]:
        return [
            SuggestedAction(label="My Bookings", action_type="send_message", action_payload={"message": "Show my counseling bookings"}),
            SuggestedAction(label="Browse Services", action_type="send_message", action_payload={"message": "Show all counseling services"}),
        ]
    elif tool_name in ["play_podcast"]:
        return [
            SuggestedAction(label="Search Podcasts", action_type="send_message", action_payload={"message": "Show available podcasts"}),
            SuggestedAction(label="Browse Courses", action_type="send_message", action_payload={"message": "Show all courses"}),
        ]
    elif tool_name in ["get_daily_guidance"]:
        return [
            SuggestedAction(label="Browse Courses", action_type="send_message", action_payload={"message": "Show available courses"}),
            SuggestedAction(label="Spiritual Podcasts", action_type="send_message", action_payload={"message": "Show spiritual podcasts"}),
        ]
    elif tool_name in ["search_products"]:
        return [
            SuggestedAction(label="Browse Courses", action_type="send_message", action_payload={"message": "Show available courses"}),
            SuggestedAction(label="View Podcasts", action_type="send_message", action_payload={"message": "Show spiritual podcasts"}),
        ]

    return []
