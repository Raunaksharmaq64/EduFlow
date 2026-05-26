from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form
from typing import Optional
from backend.models.ai import StudyPlanRequest, QuizRequest, QuizResponse
from backend.controllers.auth_controller import get_current_user
from backend.controllers.ai_controller import (
    generate_study_plan_ai,
    solve_doubt_ai,
    generate_quiz_ai
)

router = APIRouter(prefix="/api/ai", tags=["AI Features"])

@router.post("/study-plan")
async def get_study_plan(
    request: StudyPlanRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Generate a personalized study plan for a student based on their weak topics.
    """
    study_plan = await generate_study_plan_ai(
        subject=request.subject,
        grade=request.grade,
        weak_topics=request.weak_topics,
        target_goals=request.target_goals
    )
    return {
        "user_id": current_user["id"],
        "subject": request.subject,
        "grade": request.grade,
        "study_plan": study_plan
    }

@router.post("/solve-doubt")
async def solve_doubt(
    question_text: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Ask a doubt using either text, an image/screenshot of a problem, or both.
    Uses multimodal capabilities of Gemini.
    """
    if not question_text and not image:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must provide either a question text or upload an image."
        )
    
    image_bytes = None
    if image:
        # Check file type
        if not image.content_type.startswith("image/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file must be an image."
            )
        image_bytes = await image.read()
    
    explanation = await solve_doubt_ai(
        question_text=question_text,
        image_bytes=image_bytes
    )
    
    return {
        "user_id": current_user["id"],
        "question_text": question_text,
        "has_image": image is not None,
        "explanation": explanation
    }

@router.post("/generate-quiz", response_model=QuizResponse)
async def generate_quiz(
    request: QuizRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Generate a multiple-choice quiz on any topic, grade level, and difficulty.
    """
    # Optional role check: standard check if we only want teachers to create,
    # but since students can also practice, we allow all authenticated users.
    quiz_data = await generate_quiz_ai(
        topic=request.topic,
        grade=request.grade,
        num_questions=request.num_questions,
        difficulty=request.difficulty
    )
    return quiz_data
