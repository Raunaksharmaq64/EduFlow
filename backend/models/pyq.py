from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class PYQEvaluationRequest(BaseModel):
    exam_id: str = Field(..., description="ID of the exam paper or 'generated'")
    subject: str = Field(..., description="The subject of the exam")
    grade: str = Field(..., description="The grade level, e.g. 10th Grade")
    exam_title: str = Field(..., description="Title of the exam paper")
    sections: List[Dict[str, Any]] = Field(..., description="Sections and their questions data")
    student_answers: Dict[str, str] = Field(..., description="Student responses mapped by question ID")
    time_taken: str = Field(..., description="Time taken to finish, e.g. '01:45:20' or '3 hr'")
