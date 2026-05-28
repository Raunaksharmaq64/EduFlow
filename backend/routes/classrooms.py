from datetime import datetime
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from config.db import get_database
from controllers.auth_controller import get_current_user
from models.classroom import AnnouncementCreate, CommentCreate

router = APIRouter(prefix="/api/classrooms", tags=["Classrooms"])

# Helper function to create notification
async def create_notification(db, user_id: str, recipient_role: str, title: str, content: str, notif_type: str, metadata: dict = None):
    notification_doc = {
        "user_id": user_id,
        "recipient_role": recipient_role,
        "title": title,
        "content": content,
        "type": notif_type,
        "created_at": datetime.utcnow(),
        "read": False,
        "metadata": metadata or {}
    }
    await db["notifications"].insert_one(notification_doc)

@router.post("/{class_code}/announcements", status_code=status.HTTP_201_CREATED)
async def create_announcement(
    class_code: str,
    request: AnnouncementCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Teacher creates an announcement for their classroom.
    Triggers notifications for all students and their parents.
    """
    if current_user.get("role") != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers can post announcements."
        )
        
    db = get_database()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection not initialized"
        )
        
    class_code_upper = class_code.upper()
    classroom = await db["classrooms"].find_one({
        "class_code": class_code_upper,
        "teacher_id": current_user["id"]
    })
    
    if not classroom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Classroom not found or you are not authorized."
        )
        
    new_announcement = {
        "class_code": class_code_upper,
        "author_id": current_user["id"],
        "author_name": current_user["name"],
        "content": request.content,
        "created_at": datetime.utcnow(),
        "likes": [],
        "comments": []
    }
    
    result = await db["announcements"].insert_one(new_announcement)
    created_doc = await db["announcements"].find_one({"_id": result.inserted_id})
    
    # ----------------------------------------------------
    # Trigger notifications for all students and parents
    # ----------------------------------------------------
    students = classroom.get("students", [])
    for student in students:
        s_id = student.get("student_id")
        s_email = student.get("student_email", "").lower()
        s_name = student.get("student_name", "Student")
        
        # 1. Notify Student
        if s_id:
            await create_notification(
                db,
                user_id=s_id,
                recipient_role="student",
                title=f"New Announcement in {classroom['class_name']}",
                content=f"Teacher {current_user['name']} posted: \"{request.content[:60]}...\"",
                notif_type="announcement_created",
                metadata={"class_code": class_code_upper}
            )
            
        # 2. Notify Parent of Student if linked
        if s_email:
            # Find parent linked to this student
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
                    title=f"New Class Announcement — {classroom['class_name']}",
                    content=f"Teacher {current_user['name']} posted an update for {s_name}'s class.",
                    notif_type="announcement_created",
                    metadata={"class_code": class_code_upper}
                )
                
    return {
        "id": str(created_doc["_id"]),
        "class_code": created_doc["class_code"],
        "author_id": created_doc["author_id"],
        "author_name": created_doc["author_name"],
        "content": created_doc["content"],
        "created_at": created_doc["created_at"].isoformat(),
        "likes": created_doc.get("likes", []),
        "comments": created_doc.get("comments", [])
    }

@router.get("/{class_code}/announcements")
async def get_announcements(
    class_code: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Retrieve all announcements for a classroom.
    Authorized to enrolled students, teachers, or parents of students.
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
        if any(c_email in student_emails for c_email in child_emails):
            authorized = True
            
    if not authorized:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to view announcements for this classroom."
        )
        
    cursor = db["announcements"].find({"class_code": class_code_upper}).sort("created_at", -1)
    announcements_list = []
    
    async for doc in cursor:
        comments_formatted = []
        for c in doc.get("comments", []):
            comments_formatted.append({
                "comment_id": c.get("comment_id"),
                "user_id": c.get("user_id"),
                "user_name": c.get("user_name"),
                "user_role": c.get("user_role"),
                "content": c.get("content"),
                "created_at": c.get("created_at").isoformat() if isinstance(c.get("created_at"), datetime) else c.get("created_at")
            })
            
        announcements_list.append({
            "id": str(doc["_id"]),
            "class_code": doc["class_code"],
            "author_id": doc["author_id"],
            "author_name": doc["author_name"],
            "content": doc["content"],
            "created_at": doc["created_at"].isoformat() if isinstance(doc["created_at"], datetime) else doc["created_at"],
            "likes": doc.get("likes", []),
            "comments": comments_formatted
        })
        
    return announcements_list

@router.post("/{class_code}/announcements/{announcement_id}/like")
async def like_announcement(
    class_code: str,
    announcement_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Toggle like/unlike on an announcement.
    """
    db = get_database()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection not initialized"
        )
        
    try:
        announcement_oid = ObjectId(announcement_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid announcement ID."
        )
        
    announcement = await db["announcements"].find_one({"_id": announcement_oid})
    if not announcement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found."
        )
        
    user_id = current_user["id"]
    likes = announcement.get("likes", [])
    
    if user_id in likes:
        await db["announcements"].update_one(
            {"_id": announcement_oid},
            {"$pull": {"likes": user_id}}
        )
        liked = False
    else:
        await db["announcements"].update_one(
            {"_id": announcement_oid},
            {"$push": {"likes": user_id}}
        )
        liked = True
        
    return {
        "status": "success",
        "liked": liked,
        "likes_count": len(likes) - 1 if not liked else len(likes) + 1
    }

@router.post("/{class_code}/announcements/{announcement_id}/comment")
async def comment_announcement(
    class_code: str,
    announcement_id: str,
    request: CommentCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Post a comment on an announcement.
    """
    db = get_database()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection not initialized"
        )
        
    try:
        announcement_oid = ObjectId(announcement_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid announcement ID."
        )
        
    announcement = await db["announcements"].find_one({"_id": announcement_oid})
    if not announcement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found."
        )
        
    comment_id = str(ObjectId())
    new_comment = {
        "comment_id": comment_id,
        "user_id": current_user["id"],
        "user_name": current_user["name"],
        "user_role": current_user["role"],
        "content": request.content,
        "created_at": datetime.utcnow()
    }
    
    await db["announcements"].update_one(
        {"_id": announcement_oid},
        {"$push": {"comments": new_comment}}
    )
    
    new_comment["created_at"] = new_comment["created_at"].isoformat()
    return {
        "status": "success",
        "comment": new_comment
    }

@router.get("/{class_code}/leaderboard")
async def get_classroom_leaderboard(
    class_code: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Retrieve students in a classroom sorted by total XP descending.
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
        
    # Get student emails from classroom
    student_emails = [s["student_email"].lower() for s in classroom.get("students", [])]
    
    if not student_emails:
        return []
        
    # Retrieve user profiles for those students
    cursor = db["users"].find({
        "email": {"$in": student_emails},
        "role": "student"
    })
    
    students_list = []
    async for doc in cursor:
        students_list.append({
            "id": str(doc["_id"]),
            "name": doc["name"],
            "email": doc["email"],
            "xp": doc.get("xp", 0),
            "level": doc.get("level", 1)
        })
        
    # Sort by XP descending
    students_list.sort(key=lambda x: x["xp"], reverse=True)
    
    # Add ranks
    for idx, student in enumerate(students_list):
        student["rank"] = idx + 1
        
    return students_list

@router.get("/notifications")
async def get_user_notifications(
    current_user: dict = Depends(get_current_user)
):
    """
    Retrieve recent notifications for the logged-in user.
    """
    db = get_database()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection not initialized"
        )
        
    cursor = db["notifications"].find({
        "user_id": current_user["id"]
    }).sort("created_at", -1).limit(40)
    
    notifications = []
    async for doc in cursor:
        notifications.append({
            "id": str(doc["_id"]),
            "user_id": doc["user_id"],
            "recipient_role": doc["recipient_role"],
            "title": doc["title"],
            "content": doc["content"],
            "type": doc["type"],
            "created_at": doc["created_at"].isoformat() if isinstance(doc["created_at"], datetime) else doc["created_at"],
            "read": doc.get("read", False),
            "metadata": doc.get("metadata", {})
        })
        
    return notifications

@router.post("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Mark a notification as read.
    """
    db = get_database()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection not initialized"
        )
        
    try:
        notif_oid = ObjectId(notification_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid notification ID."
        )
        
    notification = await db["notifications"].find_one({"_id": notif_oid})
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found."
        )
        
    if notification["user_id"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only manage your own notifications."
        )
        
    await db["notifications"].update_one(
        {"_id": notif_oid},
        {"$set": {"read": True}}
    )
    
    return {"status": "success", "message": "Notification marked as read."}
