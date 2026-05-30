from datetime import datetime, timezone
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from config.db import get_database
from controllers.auth_controller import get_current_user
from models.assignment import (
    AssignmentCreate,
    SubmissionSubmit,
    SubmissionGrade
)

router = APIRouter(prefix="/api/assignments", tags=["Assignments"])

@router.post("/create", status_code=status.HTTP_201_CREATED)
async def create_assignment(
    request: AssignmentCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Teacher creates an assignment (manual, AI, or link).
    """
    if current_user.get("role") != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers can create assignments."
        )
        
    db = get_database()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection not initialized"
        )
        
    # Verify the teacher owns the classroom
    class_code_upper = request.class_code.upper()
    classroom = await db["classrooms"].find_one({
        "class_code": class_code_upper,
        "teacher_id": current_user["id"]
    })
    
    if not classroom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Classroom not found or you are not authorized for this classroom."
        )
        
    try:
        due_date_parsed = datetime.fromisoformat(request.due_date.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid due_date format. Must be an ISO 8601 string."
        )
        
    new_assignment = {
        "class_code": class_code_upper,
        "title": request.title,
        "description": request.description,
        "assignment_type": request.assignment_type,
        "due_date": due_date_parsed,
        "max_marks": request.max_marks,
        "gdrive_link": request.gdrive_link,
        "ai_questions": [q.dict() for q in request.ai_questions] if request.ai_questions else [],
        "teacher_id": current_user["id"],
        "created_at": datetime.now(timezone.utc)
    }
    
    result = await db["assignments"].insert_one(new_assignment)
    created_assignment = await db["assignments"].find_one({"_id": result.inserted_id})
    
    # Trigger notifications for all classroom students and parents
    try:
        from routes.classrooms import create_notification
        for student in classroom.get("students", []):
            s_id = student.get("student_id")
            s_email = student.get("student_email", "").lower()
            s_name = student.get("student_name", "Student")
            
            if s_id:
                await create_notification(
                    db,
                    user_id=s_id,
                    recipient_role="student",
                    title="New Assignment Published",
                    content=f"Teacher {current_user['name']} published '{request.title}' in {classroom['class_name']}.",
                    notif_type="assignment_created",
                    metadata={"class_code": class_code_upper, "assignment_id": str(created_assignment["_id"])}
                )
                
            if s_email:
                parent = await db["users"].find_one({
                    "linked_student_emails": s_email,
                    "role": "parent"
                })
                if parent:
                    parent_id = str(parent["_id"])
                    await create_notification(
                        db,
                        user_id=parent_id,
                        recipient_role="parent",
                        title="New Assignment Alert",
                        content=f"An assignment '{request.title}' has been assigned to {s_name} in {classroom['class_name']}.",
                        notif_type="assignment_created",
                        metadata={"class_code": class_code_upper, "assignment_id": str(created_assignment["_id"])}
                    )
    except Exception as e:
        print(f"Failed to generate assignment notifications: {e}")
        
    return {
        "id": str(created_assignment["_id"]),
        "class_code": created_assignment["class_code"],
        "title": created_assignment["title"],
        "description": created_assignment["description"],
        "assignment_type": created_assignment["assignment_type"],
        "due_date": created_assignment["due_date"].isoformat(),
        "max_marks": created_assignment["max_marks"],
        "gdrive_link": created_assignment.get("gdrive_link"),
        "ai_questions": created_assignment.get("ai_questions", []),
        "teacher_id": created_assignment["teacher_id"],
        "created_at": created_assignment["created_at"].isoformat()
    }

@router.get("/classroom/{class_code}")
async def get_classroom_assignments(
    class_code: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Retrieve all assignments for a specific classroom.
    For students/parents, it dynamically appends their corresponding submission status.
    """
    db = get_database()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection not initialized"
        )
        
    class_code_upper = class_code.upper()
    classroom = await db["classrooms"].find_one({"class_code": class_code_upper})
    if not classroom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Classroom not found."
        )
        
    # Check authorization based on role
    role = current_user.get("role")
    authorized = False
    
    if role == "teacher":
        if classroom["teacher_id"] == current_user["id"]:
            authorized = True
    elif role == "student":
        student_emails = [s["student_email"].lower() for s in classroom.get("students", [])]
        if current_user["email"].lower() in student_emails:
            authorized = True
    elif role == "parent":
        child_emails = [email.lower() for email in current_user.get("linked_student_emails", [])]
        student_emails = [s["student_email"].lower() for s in classroom.get("students", [])]
        # Check if parent has any child enrolled
        if any(c_email in student_emails for c_email in child_emails):
            authorized = True
            
    if not authorized:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to access assignments for this classroom."
        )
        
    cursor = db["assignments"].find({"class_code": class_code_upper}).sort("created_at", -1)
    assignments_list = []
    
    async for doc in cursor:
        assignment_id_str = str(doc["_id"])
        assignment_res = {
            "id": assignment_id_str,
            "class_code": doc["class_code"],
            "title": doc["title"],
            "description": doc["description"],
            "assignment_type": doc["assignment_type"],
            "due_date": doc["due_date"].isoformat() if isinstance(doc["due_date"], datetime) else doc["due_date"],
            "max_marks": doc.get("max_marks", 100),
            "gdrive_link": doc.get("gdrive_link"),
            "ai_questions": doc.get("ai_questions", []),
            "teacher_id": doc["teacher_id"],
            "created_at": doc["created_at"].isoformat() if isinstance(doc["created_at"], datetime) else doc["created_at"],
            "submission": None
        }
        
        # Attach submission details if requested by student
        if role == "student":
            sub = await db["submissions"].find_one({
                "assignment_id": assignment_id_str,
                "student_id": current_user["id"]
            })
            if sub:
                assignment_res["submission"] = {
                    "id": str(sub["_id"]),
                    "status": sub["status"],
                    "submission_text": sub.get("submission_text", ""),
                    "answers": sub.get("answers", []),
                    "submitted_at": sub["submitted_at"].isoformat() if isinstance(sub.get("submitted_at"), datetime) else None,
                    "grade": sub.get("grade"),
                    "teacher_remarks": sub.get("teacher_remarks")
                }
        elif role == "teacher":
            submissions_count = await db["submissions"].count_documents({"assignment_id": assignment_id_str})
            total_students = len(classroom.get("students", []))
            assignment_res["submissions_count"] = submissions_count
            assignment_res["total_students"] = total_students
                
        # Attach child's submission details if requested by parent
        elif role == "parent":
            child_emails = [email.lower() for email in current_user.get("linked_student_emails", [])]
            # Find the linked student enrolled in this class
            enrolled_student = None
            for s in classroom.get("students", []):
                if s["student_email"].lower() in child_emails:
                    enrolled_student = s
                    break
            
            if enrolled_student:
                sub = await db["submissions"].find_one({
                    "assignment_id": assignment_id_str,
                    "student_email": enrolled_student["student_email"].lower()
                })
                if sub:
                    assignment_res["submission"] = {
                        "id": str(sub["_id"]),
                        "student_name": enrolled_student["student_name"],
                        "status": sub["status"],
                        "submission_text": sub.get("submission_text", ""),
                        "answers": sub.get("answers", []),
                        "submitted_at": sub["submitted_at"].isoformat() if isinstance(sub.get("submitted_at"), datetime) else None,
                        "grade": sub.get("grade"),
                        "teacher_remarks": sub.get("teacher_remarks")
                    }
                    
        assignments_list.append(assignment_res)
        
    return assignments_list

@router.post("/{assignment_id}/submit", status_code=status.HTTP_201_CREATED)
async def submit_assignment(
    assignment_id: str,
    request: SubmissionSubmit,
    current_user: dict = Depends(get_current_user)
):
    """
    Student submits their completed work/answers for a specific assignment.
    Grants 50 XP to the student on submission.
    """
    if current_user.get("role") != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can submit assignments."
        )
        
    db = get_database()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection not initialized"
        )
        
    try:
        assignment_oid = ObjectId(assignment_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid assignment ID format."
        )
        
    assignment = await db["assignments"].find_one({"_id": assignment_oid})
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found."
        )
        
    # Check if student is enrolled in the classroom
    classroom = await db["classrooms"].find_one({
        "class_code": assignment["class_code"],
        "students.student_email": current_user["email"].lower()
    })
    
    if not classroom:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not enrolled in the classroom for this assignment."
        )
        
    # Update or insert submission
    submission_query = {
        "assignment_id": assignment_id,
        "student_id": current_user["id"]
    }
    
    # Check if a submission already exists
    existing = await db["submissions"].find_one(submission_query)
    if existing and existing.get("status") == "graded":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot re-submit an assignment that has already been graded."
        )
        
    submission_doc = {
        "assignment_id": assignment_id,
        "assignment_title": assignment["title"],
        "student_id": current_user["id"],
        "student_name": current_user["name"],
        "student_email": current_user["email"].lower(),
        "status": "submitted",
        "submission_text": request.submission_text,
        "answers": request.answers or [],
        "submitted_at": datetime.now(timezone.utc),
        "grade": None,
        "teacher_remarks": None
    }
    
    await db["submissions"].update_one(
        submission_query,
        {"$set": submission_doc},
        upsert=True
    )
    
    # Award 50 XP only if this is the first submission
    if not existing:
        current_xp = current_user.get("xp", 0)
        new_xp = current_xp + 50
        new_level = (new_xp // 500) + 1
        
        await db["users"].update_one(
            {"_id": current_user["_id"]},
            {"$set": {
                "xp": new_xp,
                "level": new_level
            }}
        )
        xp_earned = 50
    else:
        new_xp = current_user.get("xp", 0)
        new_level = current_user.get("level", 1)
        xp_earned = 0
    
    return {
        "status": "success",
        "message": "Assignment submitted successfully!" if existing else "Assignment submitted successfully! +50 XP Awarded.",
        "xp_earned": xp_earned,
        "new_xp": new_xp,
        "new_level": new_level
    }

@router.get("/{assignment_id}/submissions")
async def get_assignment_submissions(
    assignment_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Allows a teacher to view all student submissions for a specific assignment they created.
    """
    if current_user.get("role") != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers can inspect submissions."
        )
        
    db = get_database()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection not initialized"
        )
        
    try:
        assignment_oid = ObjectId(assignment_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid assignment ID format."
        )
        
    assignment = await db["assignments"].find_one({
        "_id": assignment_oid,
        "teacher_id": current_user["id"]
    })
    
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found or you are not authorized to view its submissions."
        )
        
    cursor = db["submissions"].find({"assignment_id": assignment_id}).sort("submitted_at", -1)
    submissions_list = []
    
    async for doc in cursor:
        submissions_list.append({
            "id": str(doc["_id"]),
            "assignment_id": doc["assignment_id"],
            "student_id": doc["student_id"],
            "student_name": doc["student_name"],
            "student_email": doc.get("student_email"),
            "status": doc["status"],
            "submission_text": doc.get("submission_text", ""),
            "answers": doc.get("answers", []),
            "submitted_at": doc["submitted_at"].isoformat() if isinstance(doc.get("submitted_at"), datetime) else None,
            "grade": doc.get("grade"),
            "teacher_remarks": doc.get("teacher_remarks")
        })
        
    return submissions_list

@router.post("/submission/{submission_id}/grade")
async def grade_submission(
    submission_id: str,
    request: SubmissionGrade,
    current_user: dict = Depends(get_current_user)
):
    """
    Allows a teacher to grade and provide remarks for a student submission.
    """
    if current_user.get("role") != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers can grade submissions."
        )
        
    db = get_database()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection not initialized"
        )
        
    try:
        submission_oid = ObjectId(submission_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid submission ID format."
        )
        
    submission = await db["submissions"].find_one({"_id": submission_oid})
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found."
        )
        
    # Verify the teacher owns the assignment belonging to this submission
    assignment = await db["assignments"].find_one({
        "_id": ObjectId(submission["assignment_id"]),
        "teacher_id": current_user["id"]
    })
    
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to grade submissions for this assignment."
        )
        
    # Validate grade against assignment max_marks
    max_marks = assignment.get("max_marks", 100)
    if request.grade > max_marks:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Grade cannot exceed assignment's maximum marks of {max_marks}."
        )
        
    update_data = {
        "status": "graded",
        "grade": request.grade,
        "teacher_remarks": request.teacher_remarks,
        "graded_at": datetime.now(timezone.utc)
    }
    
    await db["submissions"].update_one(
        {"_id": submission_oid},
        {"$set": update_data}
    )
    
    # Trigger notifications for student and parent about the graded homework
    try:
        from routes.classrooms import create_notification
        # Notify Student
        await create_notification(
            db,
            user_id=submission["student_id"],
            recipient_role="student",
            title="Assignment Graded",
            content=f"Your submission for '{assignment['title']}' has been graded: {request.grade}/{max_marks}.",
            notif_type="assignment_graded",
            metadata={"class_code": assignment["class_code"], "assignment_id": str(assignment["_id"])}
        )
        
        # Notify Parent
        student_email = submission.get("student_email", "").lower()
        if student_email:
            parent = await db["users"].find_one({
                "linked_student_emails": student_email,
                "role": "parent"
            })
            if parent:
                parent_id = str(parent["_id"])
                await create_notification(
                    db,
                    user_id=parent_id,
                    recipient_role="parent",
                    title="Homework Graded Alert",
                    content=f"Teacher graded {submission['student_name']}'s homework '{assignment['title']}': {request.grade}/{max_marks}.",
                    notif_type="assignment_graded",
                    metadata={"class_code": assignment["class_code"], "assignment_id": str(assignment["_id"])}
                )
    except Exception as e:
        print(f"Failed to generate grading notifications: {e}")
    
    return {
        "status": "success",
        "message": "Submission graded successfully.",
        "grade": request.grade,
        "teacher_remarks": request.teacher_remarks
    }

@router.delete("/{assignment_id}")
async def delete_assignment(
    assignment_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete an assignment. Cascades and deletes all student submissions.
    """
    if current_user.get("role") != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers can delete assignments."
        )
        
    db = get_database()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection not initialized"
        )
        
    try:
        asg_oid = ObjectId(assignment_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid assignment ID."
        )
        
    # Check if assignment exists and belongs to the teacher
    assignment = await db["assignments"].find_one({
        "_id": asg_oid,
        "teacher_id": current_user["id"]
    })
    
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found or you are not authorized to delete it."
        )
        
    # Delete all submissions associated with this assignment (stored as string)
    await db["submissions"].delete_many({"assignment_id": assignment_id})
    
    # Delete notifications referencing this assignment
    await db["notifications"].delete_many({"metadata.assignment_id": assignment_id})
    
    # Delete the assignment itself
    await db["assignments"].delete_one({"_id": asg_oid})
    
    return {"status": "success", "message": "Assignment and related submissions deleted successfully."}
