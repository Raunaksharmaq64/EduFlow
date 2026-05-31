from datetime import datetime, timezone
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from config.db import get_database
from controllers.auth_controller import get_current_user
from models.classroom import AnnouncementCreate, CommentCreate

router = APIRouter(prefix="/api/classrooms", tags=["Classrooms"])

def is_user_in_classroom(classroom: dict, user: dict) -> bool:
    role = user.get("role")
    if role == "teacher":
        return classroom.get("teacher_id") == user.get("id")
    elif role == "student":
        student_emails = [s["student_email"].lower() for s in classroom.get("students", [])]
        return user.get("email", "").lower() in student_emails
    elif role == "parent":
        child_emails = [email.lower() for email in user.get("linked_student_emails", [])]
        student_emails = [s["student_email"].lower() for s in classroom.get("students", [])]
        return any(c_email in student_emails for c_email in child_emails)
    return False

# Helper function to create notification
async def create_notification(db, user_id: str, recipient_role: str, title: str, content: str, notif_type: str, metadata: dict = None):
    notification_doc = {
        "user_id": user_id,
        "recipient_role": recipient_role,
        "title": title,
        "content": content,
        "type": notif_type,
        "created_at": datetime.now(timezone.utc),
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
        "created_at": datetime.now(timezone.utc),
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
        
    if not is_user_in_classroom(classroom, current_user):
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
        
    class_code_upper = class_code.upper()
    classroom = await db["classrooms"].find_one({"class_code": class_code_upper})
    if not classroom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Classroom not found."
        )
        
    if not is_user_in_classroom(classroom, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized for this classroom."
        )

    try:
        announcement_oid = ObjectId(announcement_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid announcement ID."
        )
        
    announcement = await db["announcements"].find_one({"_id": announcement_oid, "class_code": class_code_upper})
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
        
    class_code_upper = class_code.upper()
    classroom = await db["classrooms"].find_one({"class_code": class_code_upper})
    if not classroom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Classroom not found."
        )
        
    if not is_user_in_classroom(classroom, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized for this classroom."
        )

    try:
        announcement_oid = ObjectId(announcement_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid announcement ID."
        )
        
    announcement = await db["announcements"].find_one({"_id": announcement_oid, "class_code": class_code_upper})
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
        "created_at": datetime.now(timezone.utc)
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
        
    if not is_user_in_classroom(classroom, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized for this classroom."
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

@router.delete("/notifications/{notification_id}")
async def delete_notification(
    notification_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete a single notification.
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
            detail="You can only delete your own notifications."
        )
        
    await db["notifications"].delete_one({"_id": notif_oid})
    return {"status": "success", "message": "Notification deleted."}

@router.delete("/notifications")
async def clear_notifications(
    current_user: dict = Depends(get_current_user)
):
    """
    Clear (delete) all notifications for the current user.
    """
    db = get_database()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection not initialized"
        )
        
    result = await db["notifications"].delete_many({"user_id": current_user["id"]})
    return {"status": "success", "message": f"Cleared {result.deleted_count} notifications."}

@router.delete("/{class_code}/announcements/{announcement_id}")
async def delete_announcement(
    class_code: str,
    announcement_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete an announcement. Only classroom teacher can delete announcements.
    """
    if current_user.get("role") != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers can delete announcements."
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
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized for this classroom."
        )
        
    try:
        ann_oid = ObjectId(announcement_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid announcement ID."
        )
        
    announcement = await db["announcements"].find_one({
        "_id": ann_oid,
        "class_code": class_code_upper
    })
    if not announcement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found."
        )
        
    await db["announcements"].delete_one({"_id": ann_oid})
    return {"status": "success", "message": "Announcement deleted successfully."}

@router.delete("/{class_code}")
async def delete_classroom(
    class_code: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete a classroom. Only classroom teacher can delete it.
    Cascades and cleans up:
    - Classroom document
    - Student users class enrollment
    - Announcements & comments
    - Assignments & submissions
    - Classroom-related notifications
    """
    if current_user.get("role") != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers can delete classrooms."
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
            detail="Classroom not found or you are not authorized to delete it."
        )
        
    # 1. Pull classroom from all student class_codes
    await db["users"].update_many(
        {"role": "student", "class_codes": class_code_upper},
        {"$pull": {"class_codes": class_code_upper}}
    )
    
    # 2. Delete all announcements for this class
    await db["announcements"].delete_many({"class_code": class_code_upper})
    
    # 3. Find all assignments for this class to cascade submissions
    assignments_cursor = db["assignments"].find({"class_code": class_code_upper})
    assignment_ids = []
    async for asg in assignments_cursor:
        assignment_ids.append(str(asg["_id"]))
        
    if assignment_ids:
        # Delete submissions
        await db["submissions"].delete_many({"assignment_id": {"$in": assignment_ids}})
        # Delete assignments
        await db["assignments"].delete_many({"class_code": class_code_upper})
        
    # 4. Delete notifications matching class_code
    await db["notifications"].delete_many({"metadata.class_code": class_code_upper})
    
    # 5. Delete classroom document
    await db["classrooms"].delete_one({"_id": classroom["_id"]})
    
    return {"status": "success", "message": f"Classroom {class_code_upper} deleted successfully."}


@router.get("/teacher/pending-requests")
async def get_teacher_all_pending_requests(
    current_user: dict = Depends(get_current_user)
):
    """
    Retrieve all pending join requests across all classrooms of this teacher.
    """
    if current_user.get("role") != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers can inspect pending requests."
        )
        
    db = get_database()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection not initialized"
        )
        
    cursor = db["classrooms"].find({"teacher_id": current_user["id"]})
    all_pending = []
    async for cl in cursor:
        pending_students = cl.get("pending_students", []) or []
        for s in pending_students:
            all_pending.append({
                "class_code": cl["class_code"],
                "class_name": cl["class_name"],
                "student_id": s["student_id"],
                "student_name": s["student_name"],
                "student_email": s["student_email"]
            })
            
    return all_pending


@router.get("/{class_code}/join-requests")
async def get_join_requests(
    class_code: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Retrieve pending join requests for a specific classroom.
    """
    if current_user.get("role") != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers can inspect classroom join requests."
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
        
    return classroom.get("pending_students", []) or []


@router.post("/{class_code}/join-requests/{student_id}/approve")
async def approve_join_request(
    class_code: str,
    student_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Approve a student's request to join a specific classroom.
    """
    if current_user.get("role") != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers can approve join requests."
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
        
    pending_students = classroom.get("pending_students", []) or []
    student_match = [s for s in pending_students if s["student_id"] == student_id]
    
    if not student_match:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pending student request not found."
        )
        
    student_obj = student_match[0]
    
    # 1. Pull student from pending_students
    await db["classrooms"].update_one(
        {"_id": classroom["_id"]},
        {"$pull": {"pending_students": {"student_id": student_id}}}
    )
    
    # 2. Add student to classroom students list (if not already enrolled)
    student_exists = any(s["student_id"] == student_id for s in classroom.get("students", []) or [])
    if not student_exists:
        enrollment_obj = {
            "student_id": student_id,
            "student_name": student_obj["student_name"],
            "student_email": student_obj["student_email"]
        }
        await db["classrooms"].update_one(
            {"_id": classroom["_id"]},
            {"$push": {"students": enrollment_obj}}
        )
        
        # 3. Add classroom code to student's class_codes list in users collection
        from bson import ObjectId
        student_user = await db["users"].find_one({"_id": ObjectId(student_id)})
        if student_user:
            class_codes = student_user.get("class_codes", []) or []
            if class_code_upper not in class_codes:
                class_codes.append(class_code_upper)
                await db["users"].update_one(
                    {"_id": ObjectId(student_id)},
                    {"$set": {"class_codes": class_codes}}
                )
                
            # 4. Trigger notifications for student and linked parents
            try:
                # 4a. Notify Student
                await create_notification(
                    db,
                    user_id=student_id,
                    recipient_role="student",
                    title="Classroom Request Approved",
                    content=f"Teacher {current_user['name']} approved your request to join '{classroom['class_name']}'.",
                    notif_type="student_joined",
                    metadata={"class_code": class_code_upper}
                )
                
                # 4b. Notify Parent of Student if linked
                student_email = student_obj["student_email"].lower()
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
                        title="Classroom Joined Alert",
                        content=f"Your child {student_obj['student_name']} joined classroom '{classroom['class_name']}' by {classroom['teacher_name']}.",
                        notif_type="child_joined_class",
                        metadata={"class_code": class_code_upper}
                    )
            except Exception as e:
                print(f"Failed to generate request approval notifications: {e}")
                
    return {"status": "success", "message": f"Approved join request for {student_obj['student_name']}."}


@router.post("/{class_code}/join-requests/{student_id}/reject")
async def reject_join_request(
    class_code: str,
    student_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Decline/reject a student's request to join a specific classroom.
    """
    if current_user.get("role") != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers can reject join requests."
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
        
    pending_students = classroom.get("pending_students", []) or []
    student_match = [s for s in pending_students if s["student_id"] == student_id]
    
    if not student_match:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pending student request not found."
        )
        
    student_obj = student_match[0]
    
    # 1. Pull student from pending_students
    await db["classrooms"].update_one(
        {"_id": classroom["_id"]},
        {"$pull": {"pending_students": {"student_id": student_id}}}
    )
    
    # 2. Trigger notifications for student (declined request)
    try:
        await create_notification(
            db,
            user_id=student_id,
            recipient_role="student",
            title="Classroom Request Declined",
            content=f"Your request to join '{classroom['class_name']}' was declined by the teacher.",
            notif_type="request_rejected",
            metadata={"class_code": class_code_upper}
        )
    except Exception as e:
        print(f"Failed to generate request rejection notification: {e}")
        
    return {"status": "success", "message": f"Declined join request for {student_obj['student_name']}."}

