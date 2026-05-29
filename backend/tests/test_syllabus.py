import asyncio
import os
import sys

# Add parent path to import backend modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.db import connect_to_mongo, close_mongo_connection, get_database

async def run_syllabus_tests():
    print("=" * 60)
    print(">>> RUNNING NCERT SYLLABUS DATABASE VERIFICATION TESTS <<<")
    print("=" * 60)
    
    await connect_to_mongo()
    db = get_database()
    
    if db is None:
        print("ERROR: Could not connect to database.")
        sys.exit(1)
        
    try:
        # 1. Verify connection and distinct grades
        grades = await db["syllabus"].distinct("grade")
        print(f"[TEST 1] Distinct grades found: {grades}")
        assert len(grades) > 0, "No grades found in syllabus database!"
        assert "10th Grade" in grades, "Class 10 (10th Grade) not found in syllabus!"
        assert "12th Grade" in grades, "Class 12 (12th Grade) not found in syllabus!"
        print("[PASS] Test 1: Grades distinct check passed.")
        
        # 2. Verify subjects in Class 10
        subjects_10 = await db["syllabus"].distinct("subject", {"grade": "10th Grade"})
        print(f"[TEST 2] Subjects in Class 10: {subjects_10}")
        assert "Science" in subjects_10, "Science not found in Class 10 syllabus!"
        assert "Mathematics" in subjects_10, "Mathematics not found in Class 10 syllabus!"
        print("[PASS] Test 2: Class 10 subjects verified.")

        # 3. Verify subjects in Class 12
        subjects_12 = await db["syllabus"].distinct("subject", {"grade": "12th Grade"})
        print(f"[TEST 3] Subjects in Class 12: {subjects_12}")
        assert "Physics" in subjects_12, "Physics not found in Class 12 syllabus!"
        assert "Chemistry" in subjects_12, "Chemistry not found in Class 12 syllabus!"
        assert "Biology" in subjects_12, "Biology not found in Class 12 syllabus!"
        assert "Mathematics" in subjects_12, "Mathematics not found in Class 12 syllabus!"
        print("[PASS] Test 3: Class 12 subjects verified.")
        
        # 4. Verify chapters for Class 10 Science
        doc = await db["syllabus"].find_one({"grade": "10th Grade", "subject": "Science"})
        assert doc is not None, "Failed to retrieve Class 10 Science syllabus document!"
        chapters = doc.get("chapters", [])
        print(f"[TEST 4] Total chapters in Class 10 Science: {len(chapters)}")
        assert len(chapters) >= 13, "Class 10 Science should have at least 13 rationalized chapters!"
        
        chapter_names = [c["chapter_name"] for c in chapters]
        assert "Chemical Reactions and Equations" in chapter_names, "Missing chemical reactions chapter!"
        assert "Light - Reflection and Refraction" in chapter_names or any("Light" in name for name in chapter_names), "Missing light chapter!"
        assert "Electricity" in chapter_names, "Missing electricity chapter!"
        print("[PASS] Test 4: Class 10 Science chapters structure verified.")
        
        print("=" * 60)
        print(">>> ALL SYLLABUS DATABASE VERIFICATION TESTS PASSED! <<<")
        print("=" * 60)
        
    except AssertionError as ae:
        print(f"\n[FAIL] ASSERTION ERROR: {ae}")
        sys.exit(1)
    except Exception as e:
        print(f"\n[FAIL] EXCEPTION OCCURRED: {e}")
        sys.exit(1)
    finally:
        await close_mongo_connection()

if __name__ == "__main__":
    asyncio.run(run_syllabus_tests())
