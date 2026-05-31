import asyncio
import os
import sys
from bson import ObjectId
from datetime import datetime, timezone

# Add parent path to import backend modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.db import connect_to_mongo, close_mongo_connection, get_database
from routes.ai import get_available_pyq_exams, get_pyq_exam_details, evaluate_pyq_exam, get_pyq_exams_analytics, get_pyq_exams_history
from models.pyq import PYQEvaluationRequest

async def run_pyq_tests():
    print("=" * 60)
    print(">>> RUNNING PYQ EXAM SIMULATOR & ANALYTICS TEST SUITE <<<")
    print("=" * 60)
    
    await connect_to_mongo()
    db = get_database()
    
    if db is None:
        print("ERROR: Could not connect to database.")
        sys.exit(1)
        
    s_id = "test_student_pyq_123"
    s_email = "test_student_pyq@example.com"
    current_user = {
        "id": s_id,
        "name": "PYQ Student Tester",
        "email": s_email,
        "role": "student"
    }
    
    try:
        # 1. Setup: Clean up old test data in database
        await db["pyq_exam_history"].delete_many({"user_id": s_id})
        
        # 2. Test get_available_pyq_exams
        print("[TEST 1] Testing available CBSE board papers retrieval...")
        papers = await get_available_pyq_exams(current_user=current_user)
        assert len(papers) > 0, "No CBSE board papers found in database! Seed script must be run."
        print(f"[PASS] Retrieved {len(papers)} available CBSE papers.")
        
        # Take the first paper to test details
        target_paper = papers[0]
        paper_id = target_paper["id"]
        
        # 3. Test get_pyq_exam_details
        print("[TEST 2] Testing detail paper retrieval (integrity check)...")
        detail = await get_pyq_exam_details(exam_id=paper_id, current_user=current_user)
        assert detail["id"] == paper_id
        assert "sections" in detail
        
        # Assert that correct options and model answers are stripped for students
        for sec in detail["sections"]:
            for q in sec["questions"]:
                assert "correct_option" not in q, "Security leak: MCQ correct option found in detail payload!"
                assert "model_answer" not in q, "Security leak: Short/Long model answer found in detail payload!"
        print("[PASS] Exam details successfully retrieved with correct answers stripped.")
        
        # Get the full paper directly from DB (including answer key) to mock responses
        raw_paper = await db["cbse_pyq_papers"].find_one({"_id": ObjectId(paper_id)})
        
        # Mock student answers
        student_answers = {}
        for sec in raw_paper["sections"]:
            for q in sec["questions"]:
                if q["question_type"] == "mcq":
                    # Answer correctly
                    student_answers[q["id"]] = q["correct_option"]
                else:
                    # Provide dummy text for short/long answers
                    student_answers[q["id"]] = "This is a detailed student response explaining the concept step-by-step."

        # 4. Test evaluate_pyq_exam
        print("[TEST 3] Testing evaluation and attempt save...")
        eval_request = PYQEvaluationRequest(
            exam_id=paper_id,
            subject=raw_paper["subject"],
            grade=raw_paper["grade"],
            exam_title=raw_paper["exam_title"],
            sections=raw_paper["sections"],
            student_answers=student_answers,
            time_taken="2 hr 10 mins"
        )
        
        evaluation = await evaluate_pyq_exam(request=eval_request, current_user=current_user)
        
        assert "total_score" in evaluation
        assert "percentage" in evaluation
        assert "results" in evaluation
        assert "attempt_id" in evaluation
        
        # Verify attempt exists in pyq_exam_history
        attempt_doc = await db["pyq_exam_history"].find_one({"_id": ObjectId(evaluation["attempt_id"])})
        assert attempt_doc is not None
        assert attempt_doc["user_id"] == s_id
        assert len(attempt_doc["sections"]) > 0
        print("[PASS] Exam evaluation completed and saved in MongoDB history.")
        
        # 5. Test get_pyq_exams_history
        print("[TEST 4] Testing past attempts retrieval...")
        history = await get_pyq_exams_history(current_user=current_user)
        assert len(history) == 1
        assert history[0]["id"] == evaluation["attempt_id"]
        print("[PASS] Exam history list retrieved successfully.")
        
        # 6. Test get_pyq_exams_analytics
        print("[TEST 5] Testing analytics calculations & AI Coach advice...")
        analytics = await get_pyq_exams_analytics(subject=raw_paper["subject"], current_user=current_user)
        
        assert analytics["total_papers_solved"] == 1
        assert "overall_accuracy" in analytics
        assert "strong_sections" in analytics or "weak_sections" in analytics
        assert "report" in analytics
        assert len(analytics["report"]) > 10
        print("[PASS] Learning progress analytics, accuracy, and AI report compiled successfully.")
        
        # 7. Cleanup
        await db["pyq_exam_history"].delete_many({"user_id": s_id})
        print("[CLEANUP] Scoped test history documents deleted.")
        
        print("=" * 60)
        print(">>> ALL PYQ EXAM SIMULATOR AND ANALYTICS TESTS PASSED! <<<")
        print("=" * 60)
        
    except AssertionError as ae:
        print(f"\n[FAIL] ASSERTION ERROR: {ae}")
        await db["pyq_exam_history"].delete_many({"user_id": s_id})
        sys.exit(1)
    except Exception as e:
        print(f"\n[FAIL] EXCEPTION OCCURRED: {e}")
        await db["pyq_exam_history"].delete_many({"user_id": s_id})
        sys.exit(1)
    finally:
        await close_mongo_connection()

if __name__ == "__main__":
    asyncio.run(run_pyq_tests())
