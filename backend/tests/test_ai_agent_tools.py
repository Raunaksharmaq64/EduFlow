import asyncio
import os
import sys
from unittest.mock import MagicMock, patch
from bson import ObjectId
from datetime import datetime

# Add parent path to import backend modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.db import connect_to_mongo, close_mongo_connection, get_database
from controllers.ai_controller import solve_doubt_ai, generate_quiz_ai

async def run_ai_agent_tests():
    print("=" * 60)
    print(">>> RUNNING AI PERSONALIZATION & QUIZ FORMAT TESTS <<<")
    print("=" * 60)
    
    await connect_to_mongo()
    db = get_database()
    
    if db is None:
        print("ERROR: Could not connect to database.")
        sys.exit(1)
        
    s_email = "test_student_ai@example.com"
    
    try:
        # 1. SETUP: Clean up old test data if any
        await db["users"].delete_many({"email": s_email})
        
        # 2. INSERT: Test Student with default persona
        student_id = ObjectId()
        student_doc = {
            "_id": student_id,
            "name": "AI Tester Student",
            "email": s_email,
            "role": "student",
            "tutor_persona": "analogy",
            "created_at": datetime.utcnow()
        }
        await db["users"].insert_one(student_doc)
        print("[SETUP] Inserted test student.")

        # 3. TEST: Update Profile tutor_persona
        # Update user document with tutor_persona
        await db["users"].update_one(
            {"_id": student_id},
            {"$set": {
                "tutor_persona": "socratic"
            }}
        )
        
        # Verify db updates
        db_student = await db["users"].find_one({"_id": student_id})
        assert db_student.get("tutor_persona") == "socratic", "Failed to save tutor_persona to DB"
        print("[PASS] Test 1: Saved and verified tutor_persona in database.")

        # 4. TEST: solve_doubt_ai persona instructions
        print("[TEST 2] Testing solve_doubt_ai prompt construction...")
        with patch('google.generativeai.GenerativeModel') as mock_model_class:
            mock_model = MagicMock()
            mock_response = MagicMock()
            mock_response.text = "Mocked Socratic explanation"
            mock_model.generate_content.return_value = mock_response
            mock_model_class.return_value = mock_model
            
            # Run Socratic Persona
            res = await solve_doubt_ai(question_text="How does gravity work?", tutor_persona="socratic")
            
            # Assert generate_content was called and check that the prompt contained Socratic instructions
            args, kwargs = mock_model.generate_content.call_args
            prompt_used = args[0][-1]  # The prompt text is the last item in the contents array
            
            assert "Socratic" in prompt_used, "Socratic instruction missing from prompt!"
            assert "Do NOT give the direct answer" in prompt_used, "Socratic warning missing from prompt!"
            assert res == "Mocked Socratic explanation"
            print("[PASS] Test 2a: Socratic persona doubt solving prompt validated successfully.")

            # Run Analogy Persona
            res_analogy = await solve_doubt_ai(question_text="How does gravity work?", tutor_persona="analogy")
            args, kwargs = mock_model.generate_content.call_args
            prompt_used_analogy = args[0][-1]
            assert "Analogy Master" in prompt_used_analogy, "Analogy instruction missing from prompt!"
            print("[PASS] Test 2b: Analogy persona doubt solving prompt validated successfully.")

            # Run Exam Persona
            res_exam = await solve_doubt_ai(question_text="How does gravity work?", tutor_persona="exam")
            args, kwargs = mock_model.generate_content.call_args
            prompt_used_exam = args[0][-1]
            assert "Exam Drill Coach" in prompt_used_exam, "Exam instruction missing from prompt!"
            print("[PASS] Test 2c: Exam persona doubt solving prompt validated successfully.")

        # 5. TEST: generate_quiz_ai question formatting
        print("[TEST 3] Testing generate_quiz_ai question format prompt constructions...")
        with patch('google.generativeai.GenerativeModel') as mock_model_class:
            mock_model = MagicMock()
            mock_response = MagicMock()
            mock_response.text = '{"topic": "Gravity", "grade": "10th Grade", "difficulty": "medium", "questions": []}'
            mock_model.generate_content.return_value = mock_response
            mock_model_class.return_value = mock_model
            
            # Test True/False format request
            await generate_quiz_ai(topic="Gravity", grade="10th Grade", question_type="tf")
            args, kwargs = mock_model.generate_content.call_args
            prompt_used = args[0]
            assert "True/False" in prompt_used, "True/False instruction missing from quiz generation prompt!"
            assert "['True', 'False']" in prompt_used, "True/False options enforcement instruction missing!"
            print("[PASS] Test 3a: True/False format instructions verified in prompt.")

            # Test Fill in the Blanks format request
            await generate_quiz_ai(topic="Gravity", grade="10th Grade", question_type="fill")
            args, kwargs = mock_model.generate_content.call_args
            prompt_used = args[0]
            assert "Fill in the Blanks" in prompt_used, "Fill-in-the-blank instruction missing from quiz generation prompt!"
            assert "________" in prompt_used, "Blank indicator placeholder missing from quiz generation prompt!"
            print("[PASS] Test 3b: Fill in the Blanks format instructions verified in prompt.")

            # Test MCQ format request
            await generate_quiz_ai(topic="Gravity", grade="10th Grade", question_type="mcq")
            args, kwargs = mock_model.generate_content.call_args
            prompt_used = args[0]
            assert "multiple-choice questions" in prompt_used or "MCQ" in prompt_used, "MCQ instruction missing from quiz generation prompt!"
            print("[PASS] Test 3c: MCQ format instructions verified in prompt.")

        # 6. TEST: Phone Normalization Logic
        print("[TEST 4] Testing phone normalization logic...")
        from routes.auth import normalize_phone
        assert normalize_phone("+91 99999 88888") == "+919999988888", "Failed to normalize space-formatted number"
        assert normalize_phone("09876543210") == "9876543210", "Failed to normalize leading zero"
        assert normalize_phone("+0123 456") == "+123456", "Failed to normalize +0 prefix"
        assert normalize_phone("98765-43210") == "9876543210", "Failed to normalize hyphen-formatted number"
        print("[PASS] Test 4: Phone normalization rules verified successfully.")

        # 7. TEST: student-history Privacy Scoping and Pagination
        print("[TEST 5] Testing student quiz history privacy scoping and pagination...")
        from routes.ai import get_student_quiz_history
        
        # Setup Teacher, Classrooms, Syllabus, and Quizzes in database
        t_id = ObjectId()
        teacher_doc = {
            "_id": t_id,
            "name": "Teacher Scoping",
            "email": "teacher_scope@example.com",
            "role": "teacher",
            "subject": "science"
        }
        
        student_email = "student_scope@example.com"
        classroom_doc = {
            "class_code": "SCOPE1",
            "class_name": "General Science 101",
            "teacher_id": str(t_id),
            "teacher_name": "Teacher Scoping",
            "students": [{"student_email": student_email}]
        }
        
        syllabus_doc = {
            "grade": "10th Grade",
            "subject": "Science",
            "chapters": [{"chapter_name": "Chemical Reactions"}],
            "is_test": True
        }
        
        quizzes = [
            {"student_email": student_email, "user_id": "std1", "topic": "Chemical Reactions", "difficulty": "medium", "score": 8, "total_questions": 10, "created_at": datetime.utcnow()},
            {"student_email": student_email, "user_id": "std1", "topic": "Photosynthesis", "difficulty": "medium", "score": 9, "total_questions": 10, "created_at": datetime.utcnow()},
            # Non-science quiz (Mathematics)
            {"student_email": student_email, "user_id": "std1", "topic": "Algebra", "difficulty": "medium", "score": 5, "total_questions": 10, "created_at": datetime.utcnow()}
        ]
        
        await db["users"].insert_one(teacher_doc)
        await db["classrooms"].insert_one(classroom_doc)
        await db["syllabus"].insert_one(syllabus_doc)
        await db["quiz_history"].insert_many(quizzes)
        
        # Test 1: Fetching history as teacher should only return science quizzes (using syllabus and fallback keywords)
        teacher_user = {
            "id": str(t_id),
            "_id": t_id,
            "name": "Teacher Scoping",
            "email": "teacher_scope@example.com",
            "role": "teacher",
            "subject": "science"
        }
        
        history = await get_student_quiz_history(
            student_email=student_email,
            page=1,
            limit=10,
            current_user=teacher_user
        )
        
        # Verify that Algebra (Mathematics quiz) is filtered out and not in the history
        topics = [h["topic"] for h in history]
        assert "Chemical Reactions" in topics or "Photosynthesis" in topics, "Allowed quizzes missing from filtered history"
        assert "Algebra" not in topics, "Unpermitted quiz allowed through privacy scope!"
        print("[PASS] Test 5a: Teacher academic privacy filtering scoping verified successfully.")
        
        # Test 2: Pagination limits and pages
        history_page1 = await get_student_quiz_history(
            student_email=student_email,
            page=1,
            limit=1,
            current_user=teacher_user
        )
        assert len(history_page1) == 1, "Pagination limit enforcement failed!"
        print("[PASS] Test 5b: History timeline pagination limits verified successfully.")
 
        # Cleanup new test data
        await db["users"].delete_many({"_id": t_id})
        await db["classrooms"].delete_many({"class_code": "SCOPE1"})
        await db["syllabus"].delete_many({"is_test": True})
        await db["quiz_history"].delete_many({"student_email": student_email})
        print("[CLEANUP] Deleted scoping test data.")
 
        # Cleanup student
        await db["users"].delete_many({"email": s_email})
        print("[CLEANUP] Deleted test student.")
        
        print("=" * 60)
        print(">>> ALL AI PERSONALIZATION AND FORMAT VALIDATION TESTS PASSED! <<<")
        print("=" * 60)
        
    except AssertionError as ae:
        print(f"\n[FAIL] ASSERTION ERROR: {ae}")
        await db["users"].delete_many({"email": s_email})
        # Scope cleanup
        await db["users"].delete_many({"email": "teacher_scope@example.com"})
        await db["classrooms"].delete_many({"class_code": "SCOPE1"})
        await db["syllabus"].delete_many({"is_test": True})
        await db["quiz_history"].delete_many({"student_email": "student_scope@example.com"})
        sys.exit(1)
    except Exception as e:
        print(f"\n[FAIL] EXCEPTION OCCURRED: {e}")
        await db["users"].delete_many({"email": s_email})
        # Scope cleanup
        await db["users"].delete_many({"email": "teacher_scope@example.com"})
        await db["classrooms"].delete_many({"class_code": "SCOPE1"})
        await db["syllabus"].delete_many({"is_test": True})
        await db["quiz_history"].delete_many({"student_email": "student_scope@example.com"})
        sys.exit(1)
    finally:
        await close_mongo_connection()

if __name__ == "__main__":
    asyncio.run(run_ai_agent_tests())
