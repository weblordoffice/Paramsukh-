import sys, datetime
sys.path.insert(0, r'c:\Users\User\Desktop\paramsukh\Paramsukh-\ai-service')
from app.services.openai_service import OpenAIService
from app.models.chat import ChatRequest, UserContext, ConversationContext, ConversationMessage

service = OpenAIService()

# Create a conversation with mock tool executions in the history
messages = [
    ConversationMessage(
        role="user",
        content="Show my bookings"
    ),
    ConversationMessage(
        role="tool",
        content="I found 1 booking.",
        toolName="get_my_counseling_bookings",
        toolPayload={
            "result": {
                "success": True,
                "summary": "I found 1 booking.",
                "data": {
                    "bookings": [
                        {
                            "id": "booking_12345",
                            "counselor_type": "Spiritual Morning Guidance",
                            "booking_date": "2026-07-15",
                            "booking_time": "10:30 AM",
                            "status": "confirmed"
                        }
                    ]
                }
            }
        }
    ),
    ConversationMessage(
        role="assistant",
        content="You have one counseling session: Spiritual Morning Guidance on 2026-07-15 at 10:30 AM."
    ),
    ConversationMessage(
        role="user",
        content="Cancel it"
    ),
    ConversationMessage(
        role="tool",
        content="Are you sure?",
        toolName="cancel_counseling_booking",
        toolPayload={
            "result": {
                "success": True,
                "summary": "Are you sure?",
                "data": {
                    "action": "confirmation_required",
                    "booking_id": "booking_12345",
                    "counselor_type": "Spiritual Morning Guidance",
                    "booking_date": "2026-07-15",
                    "booking_time": "10:30 AM"
                }
            }
        }
    ),
    ConversationMessage(
        role="assistant",
        content="Are you sure you want to cancel your session on July 15?"
    )
]

request = ChatRequest(
    message="yes, cancel it",
    user=UserContext(user_id="test123", display_name="Test User"),
    conversation=ConversationContext(
        id="conv_123",
        recent_messages=messages
    )
)

prompt = service.build_system_prompt(request)

print("--- System Prompt Prompt Context ---")
start = prompt.find("Known context:")
if start != -1:
    print(prompt[start:])
else:
    print("Known context: not found!")

# Assertions
assert "booking_12345" in prompt, "FAIL: booking_id 'booking_12345' not injected into prompt context!"
assert "Spiritual Morning Guidance" in prompt, "FAIL: Service name not injected into prompt context!"
assert "2026-07-15" in prompt, "FAIL: Booking date not found!"
assert "action=confirmation_required" in prompt, "FAIL: confirmation status not found!"

print("\nSUCCESS: All counseling context assertions passed! The LLM will now successfully see the booking ID and confirmation action.")
