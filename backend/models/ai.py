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

# Flashcard Schemas
class FlashcardRequest(BaseModel):
    topic: str = Field(..., example="Photosynthesis")
    grade: str = Field(..., example="8th Grade")
    num_cards: Optional[int] = Field(5, ge=1, le=12)

class FlashcardItem(BaseModel):
    front: str = Field(..., description="Front of the card (question or key concept)")
    back: str = Field(..., description="Back of the card (answer, definition or key formula)")
    explanation: Optional[str] = Field(None, description="Optional study hint or memory hook")

class FlashcardResponse(BaseModel):
    topic: str
    grade: str
    flashcards: List[FlashcardItem]

# Study Kanban Schemas
class StudyKanbanRequest(BaseModel):
    subject: str = Field(..., example="Chemistry")
    grade: str = Field(..., example="10th Grade")
    weak_topics: List[str] = Field(..., example=["Acids and Bases"])
    target_goals: Optional[str] = Field(None, example="Prepare for unit test next week")

class KanbanTaskItem(BaseModel):
    id: str = Field(..., description="Unique task card ID")
    title: str = Field(..., description="Short task description/action item")
    status: str = Field("todo", description="todo, inprogress, or completed")

class StudyKanbanResponse(BaseModel):
    id: Optional[str] = None
    subject: str
    grade: str
    tasks: List[KanbanTaskItem]

class KanbanTaskUpdate(BaseModel):
    task_id: str
    status: str = Field(..., pattern="^(todo|inprogress|completed)$")

