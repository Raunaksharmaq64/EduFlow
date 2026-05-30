from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
from bson import ObjectId
from controllers.auth_controller import get_current_user
from config.db import get_database

router = APIRouter(prefix="/api/communication", tags=["Communication"])

class SendMessageRequest(BaseModel):
    recipient_id: str
    content: str

class MessageResponse(BaseModel):
    id: str
    sender_id: str
    sender_name: str
    sender_role: str
    recipient_id: str
    recipient_name: str
    recipient_role: str
    content: str
    created_at: str

class ContactResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str

@router.get("/contacts", response_model=List[ContactResponse])
async def get_contacts(current_user: dict = Depends(get_current_user)):
    """
    Retrieve list of allowed contacts based on the user's role and linkages.
    """
    db = get_database()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection not initialized"
        )
        
    role = current_user.get("role")
    contacts = []
    seen_ids = set()
    
    if role == "teacher":
        # 1. Fetch classrooms created by this teacher
        cursor = db["classrooms"].find({"teacher_id": current_user["id"]})
        async for classroom in cursor:
            students = classroom.get("students", [])
            for s in students:
                student_id = s.get("student_id")
                student_email = s.get("student_email", "").lower()
                student_name = s.get("student_name", "Student")
                
                # Add student
                if student_id and student_id not in seen_ids:
                    seen_ids.add(student_id)
                    contacts.append({
                        "id": student_id,
                        "name": student_name,
                        "email": student_email,
                        "role": "student"
                    })
                
                # Add parent if student is linked to a parent
                if student_email:
                    # Look up if a parent exists for this student
                    parent_doc = await db["users"].find_one({
                        "linked_student_emails": student_email,
                        "role": "parent"
                    })
                    if parent_doc:
                        parent_id = str(parent_doc["_id"])
                        if parent_id not in seen_ids:
                            seen_ids.add(parent_id)
                            contacts.append({
                                "id": parent_id,
                                "name": parent_doc["name"],
                                "email": parent_doc["email"],
                                "role": "parent"
                            })
                            
    elif role == "student":
        # 1. Find classrooms the student is joined in
        student_email = current_user["email"].lower()
        cursor = db["classrooms"].find({"students.student_email": student_email})
        async for classroom in cursor:
            teacher_id = classroom.get("teacher_id")
            if teacher_id and teacher_id not in seen_ids:
                # Look up teacher email from users
                try:
                    teacher_user = await db["users"].find_one({"_id": ObjectId(teacher_id)})
                    if teacher_user:
                        seen_ids.add(teacher_id)
                        contacts.append({
                            "id": teacher_id,
                            "name": teacher_user["name"],
                            "email": teacher_user["email"],
                            "role": "teacher"
                        })
                except Exception:
                    # Fallback if ID is not ObjectId
                    seen_ids.add(teacher_id)
                    contacts.append({
                        "id": teacher_id,
                        "name": classroom.get("teacher_name", "Teacher"),
                        "email": "teacher@email.com",
                        "role": "teacher"
                    })
                    
    elif role == "parent":
        # 1. Find linked students
        student_emails = current_user.get("linked_student_emails", [])
        if student_emails:
            # Find classrooms of all linked students
            cursor = db["classrooms"].find({"students.student_email": {"$in": [email.lower() for email in student_emails]}})
            async for classroom in cursor:
                teacher_id = classroom.get("teacher_id")
                if teacher_id and teacher_id not in seen_ids:
                    try:
                        teacher_user = await db["users"].find_one({"_id": ObjectId(teacher_id)})
                        if teacher_user:
                            seen_ids.add(teacher_id)
                            contacts.append({
                                "id": teacher_id,
                                "name": teacher_user["name"],
                                "email": teacher_user["email"],
                                "role": "teacher"
                            })
                    except Exception:
                        seen_ids.add(teacher_id)
                        contacts.append({
                            "id": teacher_id,
                            "name": classroom.get("teacher_name", "Teacher"),
                            "email": "teacher@email.com",
                            "role": "teacher"
                        })
                        
    return contacts

@router.get("/messages/{contact_id}", response_model=List[MessageResponse])
async def get_messages(contact_id: str, current_user: dict = Depends(get_current_user)):
    """
    Retrieve message history between the current user and selected contact.
    """
    db = get_database()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection not initialized"
        )
        
    # Verify contact is in the authorized contacts list
    allowed_contacts = await get_contacts(current_user=current_user)
    allowed_ids = {c["id"] for c in allowed_contacts}
    if contact_id not in allowed_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to access messages with this contact."
        )
        
    my_id = current_user["id"]
    
    # Query messages matching both directions
    cursor = db["messages"].find({
        "$or": [
            {"sender_id": my_id, "recipient_id": contact_id},
            {"sender_id": contact_id, "recipient_id": my_id}
        ]
    }).sort("created_at", 1)
    
    history = []
    async for doc in cursor:
        history.append({
            "id": str(doc["_id"]),
            "sender_id": doc["sender_id"],
            "sender_name": doc["sender_name"],
            "sender_role": doc["sender_role"],
            "recipient_id": doc["recipient_id"],
            "recipient_name": doc["recipient_name"],
            "recipient_role": doc["recipient_role"],
            "content": doc["content"],
            "created_at": doc["created_at"].isoformat() if "created_at" in doc else None
        })
        
    return history

@router.post("/send", response_model=MessageResponse)
async def send_message(request: SendMessageRequest, current_user: dict = Depends(get_current_user)):
    """
    Send a direct message to a valid recipient.
    """
    db = get_database()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection not initialized"
        )
        
    recipient_id = request.recipient_id
    content = request.content.strip()
    
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message content cannot be empty."
        )
        
    # Verify recipient exists in database
    try:
        recipient = await db["users"].find_one({"_id": ObjectId(recipient_id)})
    except Exception:
        recipient = None
        
    if not recipient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipient user not found."
        )
        
    # Verify recipient is in the authorized contacts list
    allowed_contacts = await get_contacts(current_user=current_user)
    allowed_ids = {c["id"] for c in allowed_contacts}
    if recipient_id not in allowed_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to send messages to this recipient."
        )
        
    # Create the message document
    now = datetime.now(timezone.utc)
    message_doc = {
        "sender_id": current_user["id"],
        "sender_name": current_user["name"],
        "sender_role": current_user["role"],
        "recipient_id": recipient_id,
        "recipient_name": recipient["name"],
        "recipient_role": recipient["role"],
        "content": content,
        "created_at": now
    }
    
    result = await db["messages"].insert_one(message_doc)
    
    return {
        "id": str(result.inserted_id),
        "sender_id": current_user["id"],
        "sender_name": current_user["name"],
        "sender_role": current_user["role"],
        "recipient_id": recipient_id,
        "recipient_name": recipient["name"],
        "recipient_role": recipient["role"],
        "content": content,
        "created_at": now.isoformat()
    }
