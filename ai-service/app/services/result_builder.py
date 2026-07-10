from typing import Any

from app.models.chat import ResultSection, ToolExecution


def build_result_sections(tool_history: list[ToolExecution]) -> list[ResultSection]:
    sections: list[ResultSection] = []
    
    for tool_execution in tool_history:
        if not tool_execution.success or not tool_execution.result:
            continue
            
        result = tool_execution.result
        data = result.get("data")
        if not isinstance(data, dict):
            continue
            
        # Try to infer presentation_kind from tool_name if not provided
        presentation_kind = data.get("presentation_kind")
        if not presentation_kind:
            tool_name = tool_execution.tool_name
            if tool_name in ["search_courses", "get_my_enrollments", "get_continue_learning", "play_current_lesson"]:
                presentation_kind = "course_list"
            elif tool_name in ["compare_courses", "compare_events"]:
                presentation_kind = "comparison_card"
            elif tool_name in ["search_events"]:
                presentation_kind = "event_list"
            elif tool_name in ["get_my_event_registrations"]:
                presentation_kind = "registration_list"
            elif tool_name in ["search_podcasts"]:
                presentation_kind = "podcast_list"
            elif tool_name in ["get_membership_plans", "get_my_subscription"]:
                presentation_kind = "membership_list"
            elif tool_name in ["search_support_content", "get_support_messages"]:
                presentation_kind = "support_list"

        if not presentation_kind:
            continue
            
        # Try to find items to display
        items: list[Any] = []
        if "items" in data and isinstance(data["items"], list):
            items = data["items"]
        elif "courses" in data and isinstance(data["courses"], list):
            items = data["courses"]
        elif "events" in data and isinstance(data["events"], list):
            items = data["events"]
        elif "event" in data and isinstance(data["event"], dict):
            items = [data["event"]]
        elif "course" in data and isinstance(data["course"], dict):
            items = [data["course"]]
            
        section_title = None
        empty_state_message = None
        
        if not items:
            empty_state_message = "No results found."

        extra_data = {
            k: v for k, v in data.items()
            if k not in ["items", "courses", "events", "course", "event", "presentation_kind", "success", "summary"]
        }
            
        sections.append(
            ResultSection(
                section_title=section_title,
                kind=presentation_kind,
                items=items,
                empty_state_message=empty_state_message,
                **extra_data
            )
        )
        
    return sections
