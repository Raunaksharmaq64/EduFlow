from fastapi import APIRouter, HTTPException, Query, status
from typing import List
from config.db import get_database
from models.syllabus import Chapter

router = APIRouter(prefix="/api/syllabus", tags=["NCERT Syllabus"])

GRADE_ORDER = [
    "6th Grade",
    "7th Grade",
    "8th Grade",
    "9th Grade",
    "10th Grade",
    "11th Grade",
    "12th Grade"
]

@router.get("/classes", response_model=List[str])
async def get_classes():
    """
    Retrieve all available classes/grades from the NCERT syllabus database.
    """
    db = get_database()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection not initialized"
        )
    
    try:
        grades = await db["syllabus"].distinct("grade")
        # Sort grades according to our standard order
        grades.sort(key=lambda g: GRADE_ORDER.index(g) if g in GRADE_ORDER else 99)
        return grades
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch grades: {str(e)}"
        )

@router.get("/subjects", response_model=List[str])
async def get_subjects(grade: str = Query(..., description="The grade level, e.g. 10th Grade")):
    """
    Retrieve all subjects registered under a specific grade/class level.
    """
    db = get_database()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection not initialized"
        )
    
    try:
        subjects = await db["syllabus"].distinct("subject", {"grade": grade})
        # Standard alphabetical sorting
        subjects.sort()
        return subjects
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch subjects: {str(e)}"
        )

@router.get("/chapters", response_model=List[Chapter])
async def get_chapters(
    grade: str = Query(..., description="The grade level, e.g. 10th Grade"),
    subject: str = Query(..., description="The subject name, e.g. Science")
):
    """
    Retrieve the complete list of NCERT chapters and key topics for a given class and subject.
    """
    db = get_database()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection not initialized"
        )
    
    try:
        doc = await db["syllabus"].find_one({"grade": grade, "subject": subject})
        if not doc:
            return []
        
        chapters = doc.get("chapters", [])
        # Sort by chapter number ascending
        chapters.sort(key=lambda c: c.get("chapter_number", 0))
        return chapters
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch chapters: {str(e)}"
        )
