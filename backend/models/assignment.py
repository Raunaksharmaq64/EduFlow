from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class AssignmentQuestion(BaseModel):
    question_text: str
    options: Optional[List[str]] = None
    correct_answer: Optional[str] = None

class AssignmentCreate(BaseModel):
    class_code: str = Field(..., min_length=6, max_length=6)
    title: str = Field(..., min_length=3, max_length=150)
    description: str = Field(..., min_length=5)
    assignment_type: str = Field(..., pattern="^(manual|ai|link)$")
    due_date: str  # ISO 8601 string or date
    max_marks: int = Field(100, ge=0)
    gdrive_link: Optional[str] = None
    ai_questions: Optional[List[AssignmentQuestion]] = []

class AssignmentResponse(BaseModel):
    id: str
    class_code: str
    title: str
    description: str
    assignment_type: str
    due_date: datetime
    max_marks: int
    gdrive_link: Optional[str] = None
    ai_questions: Optional[List[AssignmentQuestion]] = []
    teacher_id: str
    created_at: datetime

    class Config:
        from_attributes = True

class SubmissionSubmit(BaseModel):
    submission_text: str
    answers: Optional[List[str]] = []

class SubmissionGrade(BaseModel):
    grade: int = Field(..., ge=0)
    teacher_remarks: Optional[str] = None

class SubmissionResponse(BaseModel):
    id: str
    assignment_id: str
    student_id: str
    student_name: str
    status: str  # "pending", "submitted", "graded"
    submission_text: str
    answers: Optional[List[str]] = []
    submitted_at: Optional[datetime] = None
    grade: Optional[int] = None
    teacher_remarks: Optional[str] = None

    class Config:
        from_attributes = True
