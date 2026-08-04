import json
import re
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
import google.generativeai as genai
from app.core.config import get_settings
from app.core.logging import get_logger
from typing import List, Optional

logger = get_logger(__name__)
router = APIRouter()
settings = get_settings()

class CourseExplainItem(BaseModel):
    course_id: str
    course_title: str
    course_description: str
    issue_type: str
    issue_details: str | None = None

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

class BatchExplainRequest(BaseModel):
    courses: List[CourseExplainItem]
    user_age: int
    user_occupation: str
    user_location: str | None = None

class BatchExplainResponse(BaseModel):
    explanations: dict

def verify_internal_secret(x_ai_service_secret: str | None) -> None:
    configured_secret = settings.ai_service_shared_secret
    if not configured_secret:
        return
    if x_ai_service_secret != configured_secret:
        raise HTTPException(status_code=401, detail="Invalid AI service secret.")


def _configure_genai() -> genai.GenerativeModel:
    genai.configure(api_key=settings.gemini_api_key)
    return genai.GenerativeModel(
        model_name=settings.gemini_model,
        generation_config=genai.types.GenerationConfig(max_output_tokens=150),
    )


def _extract_text(response) -> str:
    if not response.candidates:
        return ""
    c = response.candidates[0]
    if not c.content or not c.content.parts:
        return ""
    return "".join(p.text for p in c.content.parts if hasattr(p, "text") and p.text)


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
        model = genai.GenerativeModel(
            model_name=settings.gemini_model,
            system_instruction=system_prompt,
            generation_config=genai.types.GenerationConfig(max_output_tokens=150),
        )
        response = model.generate_content(contents=[user_message])
        explanation = _extract_text(response).strip()
        return RecommendationExplainResponse(explanation=explanation)
    except Exception as e:
        logger.error(f"Failed to generate recommendation explanation: {str(e)}")
        raise HTTPException(status_code=500, detail=f"LLM generation failed: {str(e)}")


@router.post("/recommendations/explain-batch", response_model=BatchExplainResponse)
async def explain_recommendation_batch(
    payload: BatchExplainRequest,
    x_ai_service_secret: str | None = Header(default=None),
) -> BatchExplainResponse:
    verify_internal_secret(x_ai_service_secret)

    if not payload.courses:
        return BatchExplainResponse(explanations={})

    course_lines = []
    for i, c in enumerate(payload.courses):
        course_lines.append(
            f"Course {i+1} (ID: {c.course_id}):\n"
            f"  Title: {c.course_title}\n"
            f"  Description: {c.course_description}\n"
            f"  Category: {c.issue_type}\n"
        )

    user_message = (
        f"User Profile:\n"
        f"- Age: {payload.user_age}\n"
        f"- Occupation: {payload.user_occupation}\n"
        f"- Location: {payload.user_location or 'Not specified'}\n\n"
        f"Courses to explain:\n{''.join(course_lines)}\n\n"
        f"Instruction: For each course above, write a warm, compassionate 1-to-2 sentence explanation "
        f"addressed directly to the user (using 'you'/'your') explaining how that specific course will help "
        f"them address their wellness concerns. Respond ONLY with a JSON object where keys are the course IDs "
        f"and values are the explanation strings. Example:\n"
        f'{{"course1": "explanation text", "course2": "explanation text"}}'
    )

    try:
        model = genai.GenerativeModel(
            model_name=settings.gemini_model,
            system_instruction="You are a compassionate wellness advisor. Respond ONLY with valid JSON.",
            generation_config=genai.types.GenerationConfig(max_output_tokens=1000),
        )
        response = model.generate_content(contents=[user_message])
        raw = _extract_text(response).strip()
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        explanations = json.loads(match.group(0)) if match else {}
        return BatchExplainResponse(explanations=explanations)
    except Exception as e:
        logger.error(f"Failed to generate batch explanations: {str(e)}")
        return BatchExplainResponse(explanations={})
