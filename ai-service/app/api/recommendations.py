from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from openai import AsyncOpenAI
from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter()
settings = get_settings()

class RecommendationExplainRequest(BaseModel):
    course_title: str
    course_description: str
    issue_type: str
    issue_details: str | None = None
    user_age: int
    user_occupation: str
    user_location: str | None = None

class RecommendationExplainResponse(BaseModel):
    explanation: str

def verify_internal_secret(x_ai_service_secret: str | None) -> None:
    configured_secret = settings.ai_service_shared_secret
    if not configured_secret:
        return
    if x_ai_service_secret != configured_secret:
        raise HTTPException(status_code=401, detail="Invalid AI service secret.")

@router.post("/recommendations/explain", response_model=RecommendationExplainResponse)
async def explain_recommendation(
    payload: RecommendationExplainRequest,
    x_ai_service_secret: str | None = Header(default=None),
) -> RecommendationExplainResponse:
    verify_internal_secret(x_ai_service_secret)
    
    system_prompt = (
        "You are a compassionate, professional wellness advisor at the ParamSukh Scientific Online Gurukul. "
        "Your task is to write a highly personalized, empathetic 1-to-2 sentence explanation of why a specific "
        "wellness course fits the user's current situation."
    )

    user_message = (
        f"User Profile:\n"
        f"- Age: {payload.user_age}\n"
        f"- Occupation: {payload.user_occupation}\n"
        f"- Location: {payload.user_location or 'Not specified'}\n"
        f"- Wellness Concern: {payload.issue_type}\n"
        f"- Concern Details: {payload.issue_details or 'None provided'}\n\n"
        f"Course Details:\n"
        f"- Title: {payload.course_title}\n"
        f"- Description: {payload.course_description}\n\n"
        f"Instruction: Write a warm, compassionate 1-to-2 sentence explanation addressed directly to the user (using 'you'/'your') "
        f"explaining how this specific course will help them address their wellness concern, taking their profile into account. "
        f"Keep it concise, empathetic, and encouraging."
    )

    try:
        client = AsyncOpenAI(api_key=settings.openai_api_key, base_url=settings.openai_api_base)
        response = await client.chat.completions.create(
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            max_tokens=150,
            temperature=0.7
        )
        explanation = response.choices[0].message.content.strip()
        return RecommendationExplainResponse(explanation=explanation)
    except Exception as e:
        logger.error(f"Failed to generate recommendation explanation: {str(e)}")
        raise HTTPException(status_code=500, detail=f"LLM generation failed: {str(e)}")
