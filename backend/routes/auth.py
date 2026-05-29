from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, status, UploadFile, File
import shutil
import os
from models.user import (
    UserCreate, UserLogin, UserResponse, Token,
    LinkStudentRequest, CreateClassroomRequest, JoinClassroomRequest, ProfileUpdateRequest
)
import random
import string
from config.db import get_database
from controllers.auth_controller import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def signup(user_data: UserCreate):
    db = get_database()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection not initialized"
        )
    
    # Convert email to lowercase to prevent duplicates
    email_lower = user_data.email.lower()
    
    # Check if email already exists
    existing_user = await db["users"].find_one({"email": email_lower})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Hash the password
    hashed_pwd = hash_password(user_data.password)
    
    # Prepare user doc with default stats
    new_user = {
        "name": user_data.name,
        "email": email_lower,
        "role": user_data.role,
        "password": hashed_pwd,
        "created_at": datetime.utcnow(),
        "xp": 0,
        "level": 1,
        "badges": []
    }
    
    result = await db["users"].insert_one(new_user)
    
    # Get created user
    created_user = await db["users"].find_one({"_id": result.inserted_id})
    created_user["id"] = str(created_user["_id"])
    return created_user

@router.post("/login", response_model=Token)
async def login(login_data: UserLogin):
    db = get_database()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection not initialized"
        )
        
    email_lower = login_data.email.lower()
    user = await db["users"].find_one({"email": email_lower})
    
    if not user or not verify_password(login_data.password, user["password"]):
         raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # Create token
    access_token = create_access_token(data={"sub": user["email"], "role": user["role"]})
    
    user["id"] = str(user["_id"])
    
    # Ensure backward compatibility for users without stats keys
    if "xp" not in user: user["xp"] = 0
    if "level" not in user: user["level"] = 1
    if "badges" not in user: user["badges"] = []
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    if "xp" not in current_user: current_user["xp"] = 0
    if "level" not in current_user: current_user["level"] = 1
    if "badges" not in current_user: current_user["badges"] = []
    return current_user

@router.post("/stats/add-xp")
async def add_xp(
    amount: int,
    action_type: str = "general",  # "quiz", "doubt", "plan"
    current_user: dict = Depends(get_current_user)
):
    db = get_database()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection not initialized"
        )
        
    current_xp = current_user.get("xp", 0)
    current_level = current_user.get("level", 1)
    current_badges = current_user.get("badges", [])
    
    new_xp = current_xp + amount
    
    # Simple level up logic: every 500 XP is a level
    new_level = (new_xp // 500) + 1
    leveled_up = new_level > current_level
    
    # Dynamic badge unlock check
    unlocked_badge = None
    
    # Badge rules based on action types and milestones
    if action_type == "quiz" and "Quiz Master" not in current_badges:
        current_badges.append("Quiz Master")
        unlocked_badge = "Quiz Master"
    elif action_type == "doubt" and "Doubt Buster" not in current_badges:
        current_badges.append("Doubt Buster")
        unlocked_badge = "Doubt Buster"
    elif action_type == "plan" and "Master Planner" not in current_badges:
        current_badges.append("Master Planner")
        unlocked_badge = "Master Planner"
        
    # Check level-based badges
    if new_level >= 3 and "Gemini Scholar" not in current_badges:
        current_badges.append("Gemini Scholar")
        unlocked_badge = "Gemini Scholar"
        
    await db["users"].update_one(
        {"_id": current_user["_id"]},
        {"$set": {
            "xp": new_xp,
            "level": new_level,
            "badges": current_badges
        }}
    )
    
    return {
        "xp": new_xp,
        "level": new_level,
        "badges": current_badges,
        "leveled_up": leveled_up,
        "unlocked_badge": unlocked_badge
    }

# ========================================================
# PARENT-STUDENT LINKING ENDPOINTS
# ========================================================

@router.post("/parent/link-student")
async def link_student(
    request: LinkStudentRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Allow parent to link a student by email.
    """
    if current_user.get("role") != "parent":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only parents can link to student accounts."
        )
    
    db = get_database()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection not initialized"
        )
    
    student_email = request.student_email.lower()
    
    # Check if student exists
    student = await db["users"].find_one({"email": student_email, "role": "student"})
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No student found with this email address."
        )
    
    # Link parent to student
    parent_email = current_user["email"]
    
    # Update Student document: set parent_email
    await db["users"].update_one(
        {"_id": student["_id"]},
        {"$set": {"parent_email": parent_email}}
    )
    
    # Update Parent document: add student email to linked_student_emails array
    linked_emails = current_user.get("linked_student_emails", [])
    if student_email not in linked_emails:
        linked_emails.append(student_email)
        await db["users"].update_one(
            {"_id": current_user["_id"]},
            {"$set": {"linked_student_emails": linked_emails}}
        )
        
    return {
        "status": "success",
        "message": f"Successfully linked child {student['name']} ({student_email}) to your account.",
        "student": {
            "name": student["name"],
            "email": student["email"],
            "xp": student.get("xp", 0),
            "level": student.get("level", 1),
            "badges": student.get("badges", [])
        }
    }

@router.get("/parent/linked-students")
async def get_linked_students(
    current_user: dict = Depends(get_current_user)
):
    """
    Get detailed stats of all students linked to this parent.
    """
    if current_user.get("role") != "parent":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only parents can access linked student details."
        )
        
    db = get_database()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection not initialized"
        )
        
    student_emails = current_user.get("linked_student_emails", [])
    
    students_cursor = db["users"].find({"email": {"$in": student_emails}, "role": "student"})
    students_list = []
    
    async for doc in students_cursor:
        students_list.append({
            "id": str(doc["_id"]),
            "name": doc["name"],
            "email": doc["email"],
            "xp": doc.get("xp", 0),
            "level": doc.get("level", 1),
            "badges": doc.get("badges", []),
            "class_codes": doc.get("class_codes", [])
        })
        
    return students_list

# ========================================================
# CLASSROOM / TEACHER-STUDENT LINKING ENDPOINTS
# ========================================================

@router.post("/teacher/create-classroom")
async def create_classroom(
    request: CreateClassroomRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Allows a teacher to create a classroom and generate a 6-character code.
    """
    if current_user.get("role") != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers can create classrooms."
        )
        
    db = get_database()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection not initialized"
        )
        
    while True:
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        existing = await db["classrooms"].find_one({"class_code": code})
        if not existing:
            break
            
    classroom_doc = {
        "class_code": code,
        "class_name": request.class_name,
        "teacher_id": current_user["id"],
        "teacher_name": current_user["name"],
        "students": [],
        "created_at": datetime.utcnow()
    }
    
    await db["classrooms"].insert_one(classroom_doc)
    
    return {
        "status": "success",
        "class_code": code,
        "class_name": request.class_name,
        "teacher_name": current_user["name"]
    }

@router.get("/teacher/classrooms")
async def get_teacher_classrooms(
    current_user: dict = Depends(get_current_user)
):
    """
    Retrieve all classrooms created by the teacher.
    """
    if current_user.get("role") != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers can access classroom lists."
        )
        
    db = get_database()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection not initialized"
        )
        
    cursor = db["classrooms"].find({"teacher_id": current_user["id"]})
    classrooms = []
    async for doc in cursor:
        classrooms.append({
            "id": str(doc["_id"]),
            "class_code": doc["class_code"],
            "class_name": doc["class_name"],
            "students_count": len(doc.get("students", []))
        })
        
    return classrooms

@router.get("/teacher/classroom/{class_code}/students")
async def get_classroom_students(
    class_code: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get progress details of all students joined in this classroom.
    """
    if current_user.get("role") != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers can inspect classroom students."
        )
        
    db = get_database()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection not initialized"
        )
        
    classroom = await db["classrooms"].find_one({"class_code": class_code.upper(), "teacher_id": current_user["id"]})
    if not classroom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Classroom not found or you are not the teacher."
        )
        
    student_emails = [s["student_email"] for s in classroom.get("students", [])]
    
    students_cursor = db["users"].find({"email": {"$in": student_emails}, "role": "student"})
    students_list = []
    
    async for doc in students_cursor:
        doubt_count = await db["doubt_history"].count_documents({"user_id": str(doc["_id"])})
        plan_count = await db["study_kanban"].count_documents({"user_id": str(doc["_id"])})
        
        latest_quiz = await db["quiz_history"].find_one(
            {"user_id": str(doc["_id"])},
            sort=[("created_at", -1)]
        )
        
        # Look up parent info linked to this student
        parent_doc = await db["users"].find_one({
            "linked_student_emails": doc["email"].lower(),
            "role": "parent"
        })
        parent_info = {
            "id": str(parent_doc["_id"]),
            "name": parent_doc["name"],
            "email": parent_doc["email"]
        } if parent_doc else None
        
        students_list.append({
            "id": str(doc["_id"]),
            "name": doc["name"],
            "email": doc["email"],
            "phone": doc.get("phone"),
            "xp": doc.get("xp", 0),
            "level": doc.get("level", 1),
            "badges": doc.get("badges", []),
            "doubts_count": doubt_count,
            "plans_count": plan_count,
            "parent": parent_info,
            "latest_quiz": {
                "topic": latest_quiz["topic"],
                "score": latest_quiz["score"],
                "total_questions": latest_quiz["total_questions"]
            } if latest_quiz else None
        })
        
    return students_list

@router.post("/student/join-classroom")
async def join_classroom(
    request: JoinClassroomRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Allow a student to join a classroom using the 6-character class code.
    """
    if current_user.get("role") != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can join classrooms."
        )
        
    db = get_database()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection not initialized"
        )
        
    code = request.class_code.upper()
    classroom = await db["classrooms"].find_one({"class_code": code})
    if not classroom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid class code. Classroom not found."
        )
        
    student_exists = any(s["student_email"] == current_user["email"] for s in classroom.get("students", []))
    
    if not student_exists:
        student_obj = {
            "student_id": current_user["id"],
            "student_name": current_user["name"],
            "student_email": current_user["email"]
        }
        await db["classrooms"].update_one(
            {"_id": classroom["_id"]},
            {"$push": {"students": student_obj}}
        )
        
        class_codes = current_user.get("class_codes", [])
        if class_codes is None:
            class_codes = []
        if code not in class_codes:
            class_codes.append(code)
            await db["users"].update_one(
                {"_id": current_user["_id"]},
                {"$set": {"class_codes": class_codes}}
            )
            
        # Trigger notifications for Teacher and Parent on successful join
        try:
            from routes.classrooms import create_notification
            
            # 1. Notify Teacher
            teacher_id = classroom.get("teacher_id")
            if teacher_id:
                await create_notification(
                    db,
                    user_id=teacher_id,
                    recipient_role="teacher",
                    title="New Student Joined",
                    content=f"Student {current_user['name']} has joined your classroom '{classroom['class_name']}'.",
                    notif_type="student_joined",
                    metadata={"class_code": code}
                )
            
            # 2. Notify Parent of Student if linked
            parent = await db["users"].find_one({
                "linked_student_emails": current_user["email"].lower(),
                "role": "parent"
            })
            if parent:
                parent_id = str(parent["_id"])
                await create_notification(
                    db,
                    user_id=parent_id,
                    recipient_role="parent",
                    title="Classroom Joined Alert",
                    content=f"Your child {current_user['name']} has joined classroom '{classroom['class_name']}' by {classroom['teacher_name']}.",
                    notif_type="child_joined_class",
                    metadata={"class_code": code}
                )
        except Exception as e:
            print(f"Failed to generate class join notifications: {e}")
            
    return {
        "status": "success",
        "message": f"Successfully joined classroom '{classroom['class_name']}' by {classroom['teacher_name']}.",
        "class_name": classroom["class_name"],
        "teacher_name": classroom["teacher_name"]
    }

@router.get("/student/classrooms")
async def get_student_classrooms(
    current_user: dict = Depends(get_current_user)
):
    """
    Retrieve all classrooms joined by this student.
    """
    if current_user.get("role") != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can inspect classroom lists."
        )
        
    db = get_database()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection not initialized"
        )
        
    class_codes = current_user.get("class_codes", []) or []
    cursor = db["classrooms"].find({"class_code": {"$in": class_codes}})
    classrooms = []
    async for doc in cursor:
        classrooms.append({
            "class_code": doc["class_code"],
            "class_name": doc["class_name"],
            "teacher_name": doc["teacher_name"]
        })
        
    return classrooms


@router.get("/parent/child/{student_email}/classrooms")
async def get_child_classrooms(
    student_email: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Retrieve all classrooms joined by the linked child.
    """
    if current_user.get("role") != "parent":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only parents can inspect child classrooms."
        )
        
    db = get_database()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection not initialized"
        )
        
    student_email_lower = student_email.lower()
    linked_emails = current_user.get("linked_student_emails", [])
    if student_email_lower not in [email.lower() for email in linked_emails]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This child is not linked to your account."
        )
        
    child = await db["users"].find_one({"email": student_email_lower, "role": "student"})
    if not child:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Child student account not found."
        )
        
    class_codes = child.get("class_codes", []) or []
    cursor = db["classrooms"].find({"class_code": {"$in": class_codes}})
    classrooms = []
    async for doc in cursor:
        classrooms.append({
            "class_code": doc["class_code"],
            "class_name": doc["class_name"],
            "teacher_name": doc["teacher_name"]
        })
        
    return classrooms

def normalize_phone(phone: str) -> str:
    if not phone:
        return phone
    # Keep only digits and '+'
    cleaned = "".join(c for c in phone if c.isdigit() or c == "+")
    if cleaned.startswith("+0"):
        cleaned = "+" + cleaned[2:]
    elif cleaned.startswith("0") and not cleaned.startswith("+"):
        cleaned = cleaned[1:]
    return cleaned

@router.put("/profile", response_model=UserResponse)
async def update_profile(
    request: ProfileUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    db = get_database()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection not initialized"
        )
    
    # Filter out None fields from update
    update_data = {k: v for k, v in request.dict().items() if v is not None}
    
    if "phone" in update_data and update_data["phone"]:
        update_data["phone"] = normalize_phone(update_data["phone"])
        
    if not update_data:
        current_user["id"] = str(current_user["_id"])
        return current_user
        
    await db["users"].update_one(
        {"_id": current_user["_id"]},
        {"$set": update_data}
    )
    
    # Fetch updated user doc
    updated_user = await db["users"].find_one({"_id": current_user["_id"]})
    updated_user["id"] = str(updated_user["_id"])
    return updated_user

@router.post("/profile/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    if not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is not an image."
        )
        
    db = get_database()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection not initialized"
        )
        
    # Ensure dir exists
    upload_dir = "static/avatars"
    os.makedirs(upload_dir, exist_ok=True)
    
    # Determine file extension
    ext = os.path.splitext(file.filename)[1]
    if not ext:
        ext = ".png"
        
    # Create unique filename
    filename = f"{current_user['id']}_avatar{ext}"
    file_path = os.path.join(upload_dir, filename)
    
    # Save file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Database update path
    profile_pic_path = f"/static/avatars/{filename}"
    await db["users"].update_one(
        {"_id": current_user["_id"]},
        {"$set": {"profile_pic": profile_pic_path}}
    )
    
    return {"status": "success", "profile_pic": profile_pic_path}

@router.get("/profile/connections")
async def get_connections(
    current_user: dict = Depends(get_current_user)
):
    from bson import ObjectId
    db = get_database()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection not initialized"
        )
        
    role = current_user.get("role")
    
    if role == "student":
        # 1. Parents
        parents_cursor = db["users"].find({
            "role": "parent",
            "linked_student_emails": current_user["email"]
        })
        parents = []
        async for p in parents_cursor:
            parents.append({
                "name": p["name"],
                "email": p["email"],
                "phone": p.get("phone"),
                "profile_pic": p.get("profile_pic"),
                "relationship": p.get("relationship")
            })
            
        # 2. Teachers
        class_codes = current_user.get("class_codes", []) or []
        classrooms_cursor = db["classrooms"].find({"class_code": {"$in": class_codes}})
        teacher_ids = []
        classroom_map = {}
        async for cl in classrooms_cursor:
            t_id = cl.get("teacher_id")
            if t_id:
                teacher_ids.append(t_id)
                classroom_map[t_id] = cl.get("class_name")
                
        teachers = []
        if teacher_ids:
            obj_ids = []
            for tid in teacher_ids:
                try:
                    obj_ids.append(ObjectId(tid))
                except:
                    pass
                    
            teachers_cursor = db["users"].find({
                "role": "teacher",
                "_id": {"$in": obj_ids}
            })
            async for t in teachers_cursor:
                t_id_str = str(t["_id"])
                teachers.append({
                    "name": t["name"],
                    "email": t["email"],
                    "phone": t.get("phone"),
                    "profile_pic": t.get("profile_pic"),
                    "subject": t.get("subject"),
                    "classroom_name": classroom_map.get(t_id_str) or "Classroom"
                })
                
        return {"parents": parents, "teachers": teachers}
        
    elif role == "parent":
        # 1. Linked Students
        student_emails = current_user.get("linked_student_emails", []) or []
        students_cursor = db["users"].find({
            "role": "student",
            "email": {"$in": student_emails}
        })
        students = []
        child_class_codes = []
        student_names_map = {}
        async for s in students_cursor:
            students.append({
                "name": s["name"],
                "email": s["email"],
                "phone": s.get("phone"),
                "profile_pic": s.get("profile_pic"),
                "grade": s.get("grade"),
                "school": s.get("school")
            })
            codes = s.get("class_codes", []) or []
            child_class_codes.extend(codes)
            for code in codes:
                student_names_map[code] = s["name"]
                
        # 2. Teachers of those students
        teachers = []
        if child_class_codes:
            classrooms_cursor = db["classrooms"].find({"class_code": {"$in": child_class_codes}})
            teacher_ids = []
            classroom_map = {}
            async for cl in classrooms_cursor:
                t_id = cl.get("teacher_id")
                if t_id:
                    teacher_ids.append(t_id)
                    code = cl.get("class_code")
                    classroom_map[t_id] = {
                        "class_name": cl.get("class_name"),
                        "student_name": student_names_map.get(code) or "Child"
                    }
                    
            if teacher_ids:
                obj_ids = []
                for tid in teacher_ids:
                    try:
                        obj_ids.append(ObjectId(tid))
                    except:
                        pass
                        
                teachers_cursor = db["users"].find({
                    "role": "teacher",
                    "_id": {"$in": obj_ids}
                })
                async for t in teachers_cursor:
                    t_id_str = str(t["_id"])
                    cl_info = classroom_map.get(t_id_str) or {}
                    teachers.append({
                        "name": t["name"],
                        "email": t["email"],
                        "phone": t.get("phone"),
                        "profile_pic": t.get("profile_pic"),
                        "subject": t.get("subject"),
                        "classroom_name": cl_info.get("class_name", "Classroom"),
                        "student_name": cl_info.get("student_name", "Child")
                    })
                    
        return {"students": students, "teachers": teachers}
        
    elif role == "teacher":
        # 1. Students in this teacher's classrooms
        classrooms_cursor = db["classrooms"].find({"teacher_id": current_user["id"]})
        student_emails = []
        classroom_names_map = {}
        async for cl in classrooms_cursor:
            cl_name = cl.get("class_name")
            for s in cl.get("students", []):
                email = s.get("student_email")
                if email:
                    student_emails.append(email)
                    classroom_names_map[email] = cl_name
                    
        students = []
        parents = []
        if student_emails:
            students_cursor = db["users"].find({
                "role": "student",
                "email": {"$in": student_emails}
            })
            async for s in students_cursor:
                students.append({
                    "name": s["name"],
                    "email": s["email"],
                    "phone": s.get("phone"),
                    "profile_pic": s.get("profile_pic"),
                    "grade": s.get("grade"),
                    "classroom_name": classroom_names_map.get(s["email"]) or "Classroom"
                })
                
            # 2. Parents of those students
            parents_cursor = db["users"].find({
                "role": "parent",
                "linked_student_emails": {"$in": student_emails}
            })
            student_name_by_email = {}
            for s in students:
                student_name_by_email[s["email"]] = s["name"]
                
            async for p in parents_cursor:
                linked_children = p.get("linked_student_emails", [])
                my_student_names = [student_name_by_email[email] for email in linked_children if email in student_name_by_email]
                parents.append({
                    "name": p["name"],
                    "email": p["email"],
                    "phone": p.get("phone"),
                    "profile_pic": p.get("profile_pic"),
                    "relationship": p.get("relationship"),
                    "student_name": ", ".join(my_student_names) or "Student"
                })
                
        return {"students": students, "parents": parents}
        
    return {"error": "Invalid role"}

