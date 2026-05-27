from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime

class UserBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=50)
    email: EmailStr
    role: str = Field(..., pattern="^(teacher|student|parent)$")

class UserCreate(UserBase):
    password: str = Field(..., min_length=6)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

from typing import List

class UserResponse(UserBase):
    id: str
    created_at: datetime
    xp: Optional[int] = 0
    level: Optional[int] = 1
    badges: Optional[List[str]] = []
    parent_email: Optional[EmailStr] = None
    class_codes: Optional[List[str]] = []

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None

# Linking and Classroom request schemas
class LinkStudentRequest(BaseModel):
    student_email: EmailStr

class CreateClassroomRequest(BaseModel):
    class_name: str = Field(..., min_length=3, max_length=100)

class JoinClassroomRequest(BaseModel):
    class_code: str = Field(..., min_length=6, max_length=6)

class SaveQuizScoreRequest(BaseModel):
    topic: str
    difficulty: str
    score: int
    total_questions: int
