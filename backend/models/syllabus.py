from pydantic import BaseModel, Field
from typing import List

class Chapter(BaseModel):
    chapter_number: int = Field(..., description="NCERT Chapter Number")
    chapter_name: str = Field(..., description="NCERT Chapter Name")
    topics: List[str] = Field(default=[], description="List of key subtopics in the chapter")

class SubjectSyllabus(BaseModel):
    grade: str = Field(..., description="Class/Grade Level, e.g. 10th Grade")
    subject: str = Field(..., description="Subject Name, e.g. Science")
    chapters: List[Chapter] = Field(default=[], description="List of chapters in the syllabus")
