from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form, Query
from typing import Optional, List
from datetime import datetime, timezone
from models.ai import (
    StudyPlanRequest, QuizRequest, QuizResponse,
    FlashcardRequest, FlashcardResponse,
    StudyKanbanRequest, StudyKanbanResponse, KanbanTaskUpdate
)
from controllers.auth_controller import get_current_user
from controllers.ai_controller import (
    generate_study_plan_ai,
    solve_doubt_ai,
    generate_quiz_ai,
    generate_flashcards_ai,
    generate_study_kanban_ai,
    generate_lesson_plan_ai,
    generate_parent_revision_guide_ai,
    generate_pyq_exam_ai,
    evaluate_pyq_exam_ai
)
from models.pyq import PYQEvaluationRequest
from bson import ObjectId

from config.db import get_database
from models.user import SaveQuizScoreRequest

router = APIRouter(prefix="/api/ai", tags=["AI Features"])

@router.post("/study-plan")
async def get_study_plan(
    request: StudyPlanRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Generate a personalized study plan for a student based on their weak topics.
    """
    study_plan = await generate_study_plan_ai(
        subject=request.subject,
        grade=request.grade,
        weak_topics=request.weak_topics,
        target_goals=request.target_goals
    )
    return {
        "user_id": current_user["id"],
        "subject": request.subject,
        "grade": request.grade,
        "study_plan": study_plan
    }

@router.post("/solve-doubt")
async def solve_doubt(
    question_text: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Ask a doubt using either text, an image/screenshot of a problem, or both.
    Uses multimodal capabilities of Gemini.
    """
    if not question_text and not image:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must provide either a question text or upload an image."
        )
    
    image_bytes = None
    if image:
        # Check file type
        if not image.content_type.startswith("image/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file must be an image."
            )
        image_bytes = await image.read()
    
    db = get_database()
    tutor_persona = "analogy"
    if db is not None:
        from bson import ObjectId
        user_doc = await db["users"].find_one({"_id": ObjectId(current_user["id"])})
        if user_doc:
            tutor_persona = user_doc.get("tutor_persona", "analogy")

    explanation = await solve_doubt_ai(
        question_text=question_text,
        image_bytes=image_bytes,
        tutor_persona=tutor_persona
    )
    if db is not None:
        doubt_doc = {
            "user_id": current_user["id"],
            "question_text": question_text or "Image-based Doubt Question",
            "has_image": image is not None,
            "explanation": explanation,
            "created_at": datetime.utcnow()
        }
        await db["doubt_history"].insert_one(doubt_doc)
    
    return {
        "user_id": current_user["id"],
        "question_text": question_text,
        "has_image": image is not None,
        "explanation": explanation
    }

@router.post("/generate-quiz", response_model=QuizResponse)
async def generate_quiz(
    request: QuizRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Generate a multiple-choice quiz on any topic, grade level, and difficulty.
    """
    db = get_database()
    difficulty = request.difficulty
    
    if db is not None:
        # Find previous quizzes on the same topic for this student (case-insensitive)
        history_cursor = db["quiz_history"].find({
            "user_id": current_user["id"],
            "topic": {"$regex": f"^{request.topic}$", "$options": "i"}
        }).sort("created_at", -1).limit(3)
        
        scores = []
        async for h in history_cursor:
            if "score" in h and "total_questions" in h and h["total_questions"] > 0:
                scores.append(h["score"] / h["total_questions"])
                
        # Adaptive: if average score of last 3 quizzes is < 60%, force easy difficulty
        if scores and (sum(scores) / len(scores)) < 0.60:
            difficulty = "easy"

    quiz_data = await generate_quiz_ai(
        topic=request.topic,
        grade=request.grade,
        num_questions=request.num_questions,
        difficulty=difficulty,
        question_type=request.question_type or "mixed"
    )
    return quiz_data

@router.post("/generate-flashcards", response_model=FlashcardResponse)
async def generate_flashcards(
    request: FlashcardRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Generate interactive active recall flashcards using AI.
    """
    cards_data = await generate_flashcards_ai(
        topic=request.topic,
        grade=request.grade,
        num_cards=request.num_cards or 5
    )
    return cards_data

@router.post("/study-kanban", response_model=StudyKanbanResponse)
async def create_study_kanban(
    request: StudyKanbanRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Generate a structured study plan and save task cards to MongoDB study_kanban.
    """
    db = get_database()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection not initialized"
        )
    
    kanban_data = await generate_study_kanban_ai(
        subject=request.subject,
        grade=request.grade,
        weak_topics=request.weak_topics,
        target_goals=request.target_goals
    )
    
    # Save/replace user's study kanban in MongoDB
    new_kanban = {
        "user_id": current_user["id"],
        "subject": request.subject,
        "grade": request.grade,
        "tasks": kanban_data["tasks"],
        "created_at": datetime.utcnow()
    }
    
    # Remove older plan for the same subject
    await db["study_kanban"].delete_many({"user_id": current_user["id"], "subject": request.subject})
    
    result = await db["study_kanban"].insert_one(new_kanban)
    
    return {
        "id": str(result.inserted_id),
        "subject": request.subject,
        "grade": request.grade,
        "tasks": kanban_data["tasks"]
    }

@router.get("/study-kanban", response_model=List[StudyKanbanResponse])
async def get_study_kanban_plans(
    current_user: dict = Depends(get_current_user)
):
    """
    Retrieve all active Study Kanban plans of the student from MongoDB.
    """
    db = get_database()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection not initialized"
        )
    
    cursor = db["study_kanban"].find({"user_id": current_user["id"]})
    plans = []
    async for doc in cursor:
        plans.append({
            "id": str(doc["_id"]),
            "subject": doc["subject"],
            "grade": doc["grade"],
            "tasks": doc["tasks"]
        })
    return plans

@router.post("/study-kanban/update")
async def update_kanban_task(
    request: KanbanTaskUpdate,
    current_user: dict = Depends(get_current_user)
):
    """
    Update the status of a specific task card in the Kanban study plan.
    """
    db = get_database()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection not initialized"
        )
    
    # Update matching task status in array
    result = await db["study_kanban"].update_one(
        {"user_id": current_user["id"], "tasks.id": request.task_id},
        {"$set": {"tasks.$.status": request.status}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task card not found"
        )
        
    return {"status": "success", "task_id": request.task_id, "new_status": request.status}

@router.get("/doubts/history")
async def get_doubts_history(
    current_user: dict = Depends(get_current_user)
):
    """
    Retrieve solved doubts history logs of the student.
    """
    db = get_database()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection not initialized"
        )
    
    cursor = db["doubt_history"].find({"user_id": current_user["id"]}).sort("created_at", -1)
    history = []
    async for doc in cursor:
        history.append({
            "id": str(doc["_id"]),
            "question_text": doc["question_text"],
            "has_image": doc["has_image"],
            "explanation": doc["explanation"],
            "created_at": doc["created_at"].isoformat() if "created_at" in doc else None
        })
    return history

@router.post("/quiz/save-score")
async def save_quiz_score(
    request: SaveQuizScoreRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Saves student's quiz attempt details (topic, difficulty, score, total_questions, XP earned) to MongoDB quiz_history.
    """
    db = get_database()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection not initialized"
        )
        
    score_doc = {
        "user_id": current_user["id"],
        "student_name": current_user["name"],
        "student_email": current_user["email"],
        "topic": request.topic,
        "difficulty": request.difficulty,
        "score": request.score,
        "total_questions": request.total_questions,
        "created_at": datetime.now(timezone.utc)
    }
    
    result = await db["quiz_history"].insert_one(score_doc)
    
    return {
        "status": "success",
        "id": str(result.inserted_id),
        "topic": request.topic,
        "score": request.score
    }

@router.get("/quiz/history")
async def get_quiz_history(
    current_user: dict = Depends(get_current_user)
):
    """
    Fetches the active student's quiz history.
    """
    db = get_database()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection not initialized"
        )
        
    cursor = db["quiz_history"].find({"user_id": current_user["id"]}).sort("created_at", -1)
    history = []
    async for doc in cursor:
        history.append({
            "id": str(doc["_id"]),
            "topic": doc["topic"],
            "difficulty": doc["difficulty"],
            "score": doc["score"],
            "total_questions": doc["total_questions"],
            "created_at": doc["created_at"].isoformat() if "created_at" in doc else None
        })
        
    return history

async def get_subject_for_topic(topic: str) -> Optional[str]:
    db = get_database()
    if db is None:
        return None
    doc = await db["syllabus"].find_one({
        "chapters.chapter_name": {"$regex": f"^{topic}$", "$options": "i"}
    })
    if doc:
        return doc.get("subject", "").lower().strip()
    return None

@router.get("/quiz/student-history/{student_email}")
async def get_student_quiz_history(
    student_email: str,
    page: int = 1,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """
    Fetches a specific student's quiz history for their linked teachers or parents.
    Supports subject privacy scoping for teachers and database pagination.
    """
    db = get_database()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection not initialized"
        )
        
    # Check permissions
    role = current_user.get("role")
    email = current_user.get("email")
    
    authorized = False
    teacher_subjects = []
    if role == "teacher":
        # Find all classrooms of this teacher where this student is enrolled
        classrooms_cursor = db["classrooms"].find({
            "teacher_id": current_user["id"],
            "students.student_email": student_email.lower()
        })
        classrooms = []
        async for cl in classrooms_cursor:
            classrooms.append(cl)
            
        if classrooms:
            authorized = True
            # Inferred teacher subjects from profile
            teacher_subject = current_user.get("subject")
            if teacher_subject:
                teacher_subjects.append(teacher_subject.lower().strip())
            
            # Inferred subjects from classroom names
            for cl in classrooms:
                class_name = cl.get("class_name", "").lower()
                for sub in ["science", "mathematics", "math", "physics", "chemistry", "biology", "history", "geography", "english"]:
                    if sub in class_name:
                        teacher_subjects.append(sub)
                        if sub == "math":
                            teacher_subjects.append("mathematics")
                            
    elif role == "parent":
        parent = await db["users"].find_one({
            "email": email,
            "linked_student_emails": student_email.lower()
        })
        if parent:
            authorized = True
            
    if not authorized:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to view this student's history."
        )
        
    query = {"student_email": student_email.lower()}
    if role == "teacher" and teacher_subjects:
        # Fetch chapters matching the teacher's subjects
        syllabus_cursor = db["syllabus"].find({
            "subject": {"$regex": f"^({'|'.join(teacher_subjects)})$", "$options": "i"}
        })
        allowed_topics = []
        async for s_doc in syllabus_cursor:
            for ch in s_doc.get("chapters", []):
                allowed_topics.append(ch.get("chapter_name"))
                
        regex_pattern = "|".join(teacher_subjects)
        or_clauses = [{"topic": {"$regex": f"({regex_pattern})", "$options": "i"}}]
        if allowed_topics:
            or_clauses.append({"topic": {"$in": allowed_topics}})
            
        query["$or"] = or_clauses
        
    skip = (page - 1) * limit
    cursor = db["quiz_history"].find(query).sort("created_at", -1).skip(skip).limit(limit)
    history = []
    async for doc in cursor:
        history.append({
            "id": str(doc["_id"]),
            "topic": doc["topic"],
            "difficulty": doc["difficulty"],
            "score": doc["score"],
            "total_questions": doc["total_questions"],
            "created_at": doc["created_at"].isoformat() if "created_at" in doc else None
        })
        
    return history

@router.get("/teacher/classroom/{class_code}/lesson-plan")
async def get_classroom_lesson_plan(
    class_code: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Scan classroom student quiz history, identify weak topic, and generate an AI lesson plan.
    """
    if current_user.get("role") != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers can access classroom lesson plans."
        )
        
    db = get_database()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection not initialized"
        )
        
    classroom = await db["classrooms"].find_one({
        "class_code": class_code.upper(),
        "teacher_id": current_user["id"]
    })
    
    if not classroom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Classroom not found or you are not authorized."
        )
        
    students = classroom.get("students", [])
    if not students:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No students have joined this classroom yet."
        )
        
    student_emails = [s["student_email"].lower() for s in students]
    
    # Fetch quiz history
    cursor = db["quiz_history"].find({"student_email": {"$in": student_emails}})
    quizzes = []
    async for q in cursor:
        quizzes.append(q)
        
    if not quizzes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No quiz history found for this classroom's students."
        )
        
    # Aggregate scores by topic
    topic_totals = {}  # topic -> sum of percentages
    topic_counts = {}  # topic -> count
    topic_student_scores = {} # topic -> {student_email -> list of scores}
    
    # Calculate classroom-wide overall average score across all quizzes
    total_percent_sum = 0.0
    for q in quizzes:
        score = q.get("score", 0)
        total_q = q.get("total_questions", 1) or 1
        percentage = (score / total_q) * 100
        total_percent_sum += percentage
        
        topic = q.get("topic", "General")
        topic_totals[topic] = topic_totals.get(topic, 0.0) + percentage
        topic_counts[topic] = topic_counts.get(topic, 0) + 1
        
        email = q.get("student_email", "").lower()
        if email:
            if topic not in topic_student_scores:
                topic_student_scores[topic] = {}
            if email not in topic_student_scores[topic]:
                topic_student_scores[topic][email] = []
            topic_student_scores[topic][email].append(percentage)
            
    overall_average = total_percent_sum / len(quizzes)
    
    # Calculate average per topic
    topic_averages = {}
    for topic, total in topic_totals.items():
        topic_averages[topic] = total / topic_counts[topic]
        
    # Find the weak topics (average score < 75%)
    weak_topics_list = [t for t, avg in topic_averages.items() if avg < 75.0]
    
    if not weak_topics_list:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Excellent classroom performance! No topics with an average score under 75% were found."
        )
        
    # Sort weak topics to find the absolute lowest average
    weak_topics_list.sort(key=lambda t: topic_averages[t])
    target_topic = weak_topics_list[0]
    target_topic_average = topic_averages[target_topic]
    
    # Struggling students are those whose average on the target topic is < 75%
    struggling_students = []
    student_details_map = {s["student_email"].lower(): s["student_name"] for s in students}
    
    for email, scores in topic_student_scores.get(target_topic, {}).items():
        avg_score = sum(scores) / len(scores)
        if avg_score < 75.0:
            struggling_students.append({
                "email": email,
                "name": student_details_map.get(email, email),
                "average": round(avg_score, 1)
            })
            
    # Call generate_lesson_plan_ai
    other_weak = [t for t in weak_topics_list if t != target_topic]
    common_misconceptions_str = f"Average class score for {target_topic} is {round(target_topic_average, 1)}%. "
    if other_weak:
        common_misconceptions_str += f"Other struggling topics in class: {', '.join(other_weak)}."
        
    lesson_plan_markdown = await generate_lesson_plan_ai(
        topic=target_topic,
        grade=classroom.get("class_name", "All Grades"),
        weak_topics=weak_topics_list,
        common_misconceptions=common_misconceptions_str
    )
    
    return {
        "overall_average": round(overall_average, 1),
        "target_topic": target_topic,
        "target_topic_average": round(target_topic_average, 1),
        "struggling_students": struggling_students,
        "lesson_plan": lesson_plan_markdown
    }

@router.get("/parent/child/{student_email}/revision-guide")
async def get_child_revision_guide(
    student_email: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Generate an AI home revision guide for a linked student child.
    """
    if current_user.get("role") != "parent":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only parents can generate home revision guides."
        )
        
    db = get_database()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection not initialized"
        )
        
    student_email_lower = student_email.lower()
    
    # Verify child is linked to this parent
    linked_emails = current_user.get("linked_student_emails", [])
    if student_email_lower not in [email.lower() for email in linked_emails]:
        # Also check child directly in case links array is out of sync
        child = await db["users"].find_one({"email": student_email_lower, "parent_email": current_user["email"].lower()})
        if not child:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not authorized or this student is not linked to your account."
            )
    else:
        child = await db["users"].find_one({"email": student_email_lower})
        
    if not child:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Linked student account not found."
        )
        
    # Retrieve student's quiz history
    cursor = db["quiz_history"].find({"student_email": student_email_lower})
    quizzes = []
    async for q in cursor:
        quizzes.append(q)
        
    if not quizzes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No quiz history found for your child. Encourage them to take a quiz first!"
        )
        
    # Aggregate scores by topic
    topic_totals = {}
    topic_counts = {}
    
    total_percent_sum = 0.0
    for q in quizzes:
        score = q.get("score", 0)
        total_q = q.get("total_questions", 1) or 1
        percentage = (score / total_q) * 100
        total_percent_sum += percentage
        
        topic = q.get("topic", "General")
        topic_totals[topic] = topic_totals.get(topic, 0.0) + percentage
        topic_counts[topic] = topic_counts.get(topic, 0) + 1
        
    overall_average = total_percent_sum / len(quizzes)
    
    topic_averages = {}
    for topic, total in topic_totals.items():
        topic_averages[topic] = total / topic_counts[topic]
        
    # Find weak topics (average score < 75%)
    weak_topics_list = [t for t, avg in topic_averages.items() if avg < 75.0]
    
    if not weak_topics_list:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your child has outstanding performance! No topics with average score under 75% were found."
        )
        
    # Find weakest topic
    weak_topics_list.sort(key=lambda t: topic_averages[t])
    target_topic = weak_topics_list[0]
    target_topic_average = topic_averages[target_topic]
    
    # Generate parenting revision guide via Gemini
    revision_guide = await generate_parent_revision_guide_ai(
        topic=target_topic,
        grade=f"Level {child.get('level', 1)} Student",
        weak_topics=weak_topics_list
    )
    
    return {
        "child_name": child.get("name", "Child"),
        "overall_average": round(overall_average, 1),
        "target_topic": target_topic,
        "target_topic_average": round(target_topic_average, 1),
        "revision_guide": revision_guide
    }


# ========================================================
# PYQ BOARD PAPER SIMULATOR ENDPOINTS
# ========================================================

@router.get("/pyq-exams/available")
async def get_available_pyq_exams(current_user: dict = Depends(get_current_user)):
    db = get_database()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection not initialized"
        )
    
    cursor = db["cbse_pyq_papers"].find({})
    papers = []
    async for doc in cursor:
        papers.append({
            "id": str(doc["_id"]),
            "year": doc.get("year"),
            "subject": doc.get("subject"),
            "grade": doc.get("grade"),
            "exam_title": doc.get("exam_title"),
            "sections": [
                {
                    "section_name": s.get("section_name"),
                    "question_count": len(s.get("questions", []))
                } for s in doc.get("sections", [])
            ]
        })
    return papers


@router.get("/pyq-exams/{exam_id}")
async def get_pyq_exam_details(exam_id: str, current_user: dict = Depends(get_current_user)):
    db = get_database()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection not initialized"
        )
    
    try:
        doc = await db["cbse_pyq_papers"].find_one({"_id": ObjectId(exam_id)})
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid exam ID format"
        )
        
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exam paper not found"
        )
    
    # Strip correct options and model answers before serving to client
    clean_sections = []
    for sec in doc.get("sections", []):
        clean_questions = []
        for q in sec.get("questions", []):
            q_copy = dict(q)
            q_copy.pop("correct_option", None)
            q_copy.pop("model_answer", None)
            clean_questions.append(q_copy)
        
        clean_sections.append({
            "section_name": sec.get("section_name"),
            "questions": clean_questions
        })
        
    return {
        "id": str(doc["_id"]),
        "year": doc.get("year"),
        "subject": doc.get("subject"),
        "grade": doc.get("grade"),
        "exam_title": doc.get("exam_title"),
        "sections": clean_sections
    }


@router.post("/generate-pyq-exam")
async def generate_pyq_exam(
    grade: str = Form(...),
    subject: str = Form(...),
    pattern_type: str = Form(...),
    num_mcq: Optional[int] = Form(None),
    num_short: Optional[int] = Form(None),
    num_long: Optional[int] = Form(None),
    pattern_text: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    current_user: dict = Depends(get_current_user)
):
    image_bytes = None
    if file:
        if not file.content_type.startswith("image/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file must be an image."
            )
        image_bytes = await file.read()
        
    exam_data = await generate_pyq_exam_ai(
        grade=grade,
        subject=subject,
        pattern_type=pattern_type,
        num_mcq=num_mcq or 0,
        num_short=num_short or 0,
        num_long=num_long or 0,
        pattern_text=pattern_text,
        image_bytes=image_bytes
    )
    return exam_data


@router.post("/evaluate-pyq-exam")
async def evaluate_pyq_exam(
    request: PYQEvaluationRequest,
    current_user: dict = Depends(get_current_user)
):
    db = get_database()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection not initialized"
        )
        
    # Evaluate answers using Gemini 2.5 Flash
    evaluation = await evaluate_pyq_exam_ai(
        sections=request.sections,
        student_answers=request.student_answers
    )
    
    # Save attempt in database
    attempt_doc = {
        "user_id": current_user["id"],
        "student_name": current_user["name"],
        "student_email": current_user["email"].lower(),
        "exam_id": request.exam_id,
        "subject": request.subject,
        "grade": request.grade,
        "exam_title": request.exam_title,
        "sections": request.sections,
        "student_answers": request.student_answers,
        "evaluation": evaluation,
        "time_taken": request.time_taken,
        "created_at": datetime.now(timezone.utc)
    }
    
    result = await db["pyq_exam_history"].insert_one(attempt_doc)
    evaluation["attempt_id"] = str(result.inserted_id)
    
    return evaluation


@router.get("/pyq-exams/history")
async def get_pyq_exams_history(current_user: dict = Depends(get_current_user)):
    db = get_database()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection not initialized"
        )
        
    cursor = db["pyq_exam_history"].find({"user_id": current_user["id"]}).sort("created_at", -1)
    history = []
    async for doc in cursor:
        history.append({
            "id": str(doc["_id"]),
            "exam_title": doc.get("exam_title"),
            "subject": doc.get("subject"),
            "grade": doc.get("grade"),
            "time_taken": doc.get("time_taken"),
            "total_score": doc.get("evaluation", {}).get("total_score"),
            "max_score": doc.get("evaluation", {}).get("max_score"),
            "percentage": doc.get("evaluation", {}).get("percentage"),
            "created_at": doc.get("created_at").isoformat() if doc.get("created_at") else None
        })
    return history


@router.get("/pyq-exams/history/{attempt_id}")
async def get_pyq_exam_attempt_detail(attempt_id: str, current_user: dict = Depends(get_current_user)):
    db = get_database()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection not initialized"
        )
    
    try:
        doc = await db["pyq_exam_history"].find_one({
            "_id": ObjectId(attempt_id),
            "user_id": current_user["id"]
        })
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid attempt ID format"
        )
        
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attempt not found"
        )
        
    return {
        "exam_title": doc.get("exam_title"),
        "subject": doc.get("subject"),
        "grade": doc.get("grade"),
        "time_taken": doc.get("time_taken"),
        "student_answers": doc.get("student_answers"),
        "evaluation": doc.get("evaluation"),
        "sections": doc.get("sections", []),
        "created_at": doc.get("created_at").isoformat() if doc.get("created_at") else None
    }


@router.get("/pyq-exams/analytics")
async def get_pyq_exams_analytics(
    subject: str = Query(..., description="The subject to run analytics on"),
    current_user: dict = Depends(get_current_user)
):
    db = get_database()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection not initialized"
        )
        
    # Get all attempts for this subject
    cursor = db["pyq_exam_history"].find({
        "user_id": current_user["id"],
        "subject": {"$regex": f"^{subject}$", "$options": "i"}
    }).sort("created_at", -1)
    
    attempts = []
    async for doc in cursor:
        attempts.append(doc)
        
    if not attempts:
        return {
            "total_papers_solved": 0,
            "overall_accuracy": 0,
            "strong_sections": [],
            "weak_sections": [],
            "report": "No exam papers solved for this subject yet. Complete your first practice board paper to unlock learning analytics from your AI Coach!"
        }
        
    # Aggregate topic scores
    # We want to check accuracy per topic
    topic_scores = {}  # topic -> { earned: float, total: float }
    total_earned = 0.0
    total_possible = 0.0
    
    for att in attempts:
        eval_data = att.get("evaluation", {})
        results = eval_data.get("results", [])
        
        # Since topic tags are stored inside the questions of the original paper, we should map question topic tags.
        # However, to be extremely reliable, we can inspect each result.
        # Let's map matching questions in attempt or use results if they contain topic or map back to database paper
        # To avoid extra DB queries, let's look up if evaluation results contain topic or if we stored original sections.
        # Let's see: results list has question_id, score, max_score.
        # We can map question_id to topic by loading the paper or parsing sections if saved.
        # But wait! We saved request.sections in evaluate endpoint? No, in evaluate endpoint request.sections is passed.
        # Let's check how we can retrieve the topic. We can match the question_id by looking in database, OR we can let evaluate endpoint save topics, OR we can inspect the database.
        # Let's inspect the database!
        # If request.sections is passed, let's load all questions from it to get their topic.
        # Let's see: we can lookup the question topic from either the seeded paper or the generated sections saved.
        # Wait, did we save request.sections in attempt_doc? No, we didn't save request.sections in attempt_doc, we only saved request.student_answers and evaluation.
        # Ah! Let's modify evaluate_pyq_exam so it saves `sections` too, or extracts topics and saves them in evaluate_pyq_exam!
        # Saving `sections` in attempt_doc is extremely simple and useful because we can reconstruct the exam exactly.
        # Let's modify the evaluate endpoint slightly to save `"sections": request.sections`.
        # Then, we can map question_id -> topic.
        # Let's check:
        # We can do this in get_pyq_exams_analytics:
        pass
        
    # Re-reading attempt documents that include sections
    for att in attempts:
        sections = att.get("sections", [])
        student_answers = att.get("student_answers", {})
        results = att.get("evaluation", {}).get("results", [])
        
        # Build question_id to topic map
        q_topics = {}
        q_max_scores = {}
        for sec in sections:
            for q in sec.get("questions", []):
                q_topics[q.get("id")] = q.get("topic", "General")
                q_max_scores[q.get("id")] = q.get("marks", 1)
                
        for r in results:
            q_id = r.get("question_id")
            score = r.get("score", 0)
            max_s = r.get("max_score", q_max_scores.get(q_id, 1))
            topic = q_topics.get(q_id, "General")
            
            if topic not in topic_scores:
                topic_scores[topic] = {"earned": 0.0, "total": 0.0}
            topic_scores[topic]["earned"] += score
            topic_scores[topic]["total"] += max_s
            
            total_earned += score
            total_possible += max_s

    # Compute accuracy per topic
    strong_sections = []
    weak_sections = []
    for topic, stats in topic_scores.items():
        if stats["total"] > 0:
            accuracy = (stats["earned"] / stats["total"]) * 100
            if accuracy >= 75.0:
                strong_sections.append(topic)
            elif accuracy < 60.0:
                weak_sections.append(topic)
                
    overall_accuracy = (total_earned / total_possible * 100) if total_possible > 0 else 0
    
    # Generate AI Coach advice via Gemini
    import google.generativeai as genai
    model = genai.GenerativeModel("gemini-2.5-flash")
    
    weak_str = ", ".join(weak_sections) if weak_sections else "None"
    strong_str = ", ".join(strong_sections) if strong_sections else "None"
    
    prompt = f"""
    You are a smart AI Coach for students. Analyze this student's exam metrics:
    - Subject: {subject}
    - Total papers solved: {len(attempts)}
    - Overall accuracy: {round(overall_accuracy, 1)}%
    - Strong Topics: {strong_str}
    - Struggling/Weak Topics: {weak_str}
    
    Write a highly encouraging, direct, and practical study recommendation for this student.
    Limit it to exactly 3 sentences. Be concise and supportive.
    """
    
    try:
        response = model.generate_content(prompt)
        report_text = response.text.strip()
    except Exception as e:
        report_text = f"Keep practicing! Your main areas of improvement are: {weak_str}. Leverage active recall and chapter quizzes."
        
    return {
        "total_papers_solved": len(attempts),
        "overall_accuracy": round(overall_accuracy, 1),
        "strong_sections": strong_sections,
        "weak_sections": weak_sections,
        "report": report_text
    }


