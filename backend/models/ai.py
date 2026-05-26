from pydantic import BaseModel, Field
from typing import List, Optional

# Study Plan Schemas
class StudyPlanRequest(BaseModel):
    subject: str = Field(..., example="Mathematics")
    grade: str = Field(..., example="10th Grade")
    weak_topics: List[str] = Field(..., example=["Quadratic Equations", "Trigonometry"])
    target_goals: Optional[str] = Field(None, example="Score above 90% in board exams")

# Quiz Schemas
class QuizRequest(BaseModel):
    topic: str = Field(..., example="Photosynthesis")
    grade: str = Field(..., example="8th Grade")
    num_questions: int = Field(5, ge=1, le=10, description="Number of questions to generate (1 to 10)")
    difficulty: str = Field("medium", example="medium", description="easy, medium, or hard")

class QuizQuestion(BaseModel):
    question_text: str = Field(..., description="The multiple choice question text")
    options: List[str] = Field(..., description="List of 4 choices for the question")
    correct_option: str = Field(..., description="The correct option from the options list")
    explanation: str = Field(..., description="Explanation of why this option is correct")

class QuizResponse(BaseModel):
    topic: str
    grade: str
    difficulty: str
    questions: List[QuizQuestion]
