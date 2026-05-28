from pydantic import BaseModel, Field

class AnnouncementCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=1000)

class CommentCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=500)
