import asyncio
import os
import sys
from bson import ObjectId
from datetime import datetime

# Add parent path to import backend modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.db import connect_to_mongo, close_mongo_connection, get_database

async def run_profile_tests():
    print("=" * 60)
    print(">>> RUNNING PROFILE AND LINKED CONNECTIONS DATABASE TESTS <<<")
    print("=" * 60)
    
    await connect_to_mongo()
    db = get_database()
    
    if db is None:
        print("ERROR: Could not connect to database.")
        sys.exit(1)
        
    # Test emails
    t_email = "test_teacher_prof@example.com"
    s_email = "test_student_prof@example.com"
    p_email = "test_parent_prof@example.com"
    class_code = "PROF99"
    
    try:
        # 1. SETUP: Clean up old test data if any
        await db["users"].delete_many({"email": {"$in": [t_email, s_email, p_email]}})
        await db["classrooms"].delete_many({"class_code": class_code})
        
        # 2. INSERT: Test users
        # Insert Teacher
        teacher_id = ObjectId()
        teacher_doc = {
            "_id": teacher_id,
            "name": "Prof. Alan Turing",
            "email": t_email,
            "role": "teacher",
            "created_at": datetime.utcnow()
        }
        
        # Insert Student
        student_id = ObjectId()
        student_doc = {
            "_id": student_id,
            "name": "Young Turing",
            "email": s_email,
            "role": "student",
            "class_codes": [class_code],
            "parent_email": p_email,
            "created_at": datetime.utcnow()
        }
        
        # Insert Parent
        parent_id = ObjectId()
        parent_doc = {
            "_id": parent_id,
            "name": "Mr. Turing Sr.",
            "email": p_email,
            "role": "parent",
            "linked_student_emails": [s_email],
            "created_at": datetime.utcnow()
        }
        
        await db["users"].insert_many([teacher_doc, student_doc, parent_doc])
        print("[SETUP] Inserted test Teacher, Student, and Parent.")
        
        # Insert Classroom linking Teacher and Student
        classroom_doc = {
            "class_code": class_code,
            "class_name": "Computer Science 101",
            "teacher_id": str(teacher_id),
            "teacher_name": "Prof. Alan Turing",
            "students": [
                {
                    "student_id": str(student_id),
                    "student_name": "Young Turing",
                    "student_email": s_email
                }
            ],
            "created_at": datetime.utcnow()
        }
        await db["classrooms"].insert_one(classroom_doc)
        print("[SETUP] Created test Classroom linking teacher and student.")
        
        # 3. TEST: Update Profile Details
        # Update student details
        await db["users"].update_one(
            {"_id": student_id},
            {"$set": {
                "phone": "+91 99999 88888",
                "bio": "Enthusiastic learning coder",
                "grade": "10th Grade",
                "school": "Science Academy"
            }}
        )
        # Update teacher details
        await db["users"].update_one(
            {"_id": teacher_id},
            {"$set": {
                "phone": "+91 77777 66666",
                "bio": "AI Researcher and Professor",
                "qualification": "PhD in Computer Science",
                "subject": "Computer Science"
            }}
        )
        # Update parent details
        await db["users"].update_one(
            {"_id": parent_id},
            {"$set": {
                "phone": "+91 55555 44444",
                "bio": "Proud parent",
                "relationship": "Father"
            }}
        )
        print("[TEST 1] Profile details updated in database.")
        
        # Verify db updates
        db_student = await db["users"].find_one({"_id": student_id})
        assert db_student.get("phone") == "+91 99999 88888"
        assert db_student.get("grade") == "10th Grade"
        
        db_teacher = await db["users"].find_one({"_id": teacher_id})
        assert db_teacher.get("qualification") == "PhD in Computer Science"
        
        db_parent = await db["users"].find_one({"_id": parent_id})
        assert db_parent.get("relationship") == "Father"
        print("[PASS] Test 1: Profile details verification passed.")
        
        # 4. TEST: Fetch Connections Logic
        # Test Student Connections Query
        # Parents check
        parents_cursor = db["users"].find({
            "role": "parent",
            "linked_student_emails": s_email
        })
        parents = []
        async for p in parents_cursor:
            parents.append(p)
        assert len(parents) == 1
        assert parents[0]["name"] == "Mr. Turing Sr."
        
        # Teachers check
        student_codes = db_student.get("class_codes", [])
        classrooms_cursor = db["classrooms"].find({"class_code": {"$in": student_codes}})
        t_ids = []
        async for cl in classrooms_cursor:
            t_ids.append(ObjectId(cl["teacher_id"]))
        
        teachers = []
        teachers_cursor = db["users"].find({"role": "teacher", "_id": {"$in": t_ids}})
        async for t in teachers_cursor:
            teachers.append(t)
        assert len(teachers) == 1
        assert teachers[0]["name"] == "Prof. Alan Turing"
        print("[PASS] Test 2: Student connections queries resolved successfully.")

        # Test Parent Connections Query
        # Linked children check
        p_linked_emails = db_parent.get("linked_student_emails", [])
        children_cursor = db["users"].find({"role": "student", "email": {"$in": p_linked_emails}})
        children = []
        c_codes = []
        async for child in children_cursor:
            children.append(child)
            c_codes.extend(child.get("class_codes", []) or [])
        assert len(children) == 1
        assert children[0]["name"] == "Young Turing"
        
        # Children's teachers check
        teachers_parent = []
        p_classrooms_cursor = db["classrooms"].find({"class_code": {"$in": c_codes}})
        pt_ids = []
        async for cl in p_classrooms_cursor:
            pt_ids.append(ObjectId(cl["teacher_id"]))
            
        teachers_parent_cursor = db["users"].find({"role": "teacher", "_id": {"$in": pt_ids}})
        async for t in teachers_parent_cursor:
            teachers_parent.append(t)
        assert len(teachers_parent) == 1
        assert teachers_parent[0]["name"] == "Prof. Alan Turing"
        print("[PASS] Test 3: Parent connections queries resolved successfully.")

        # Test Teacher Connections Query
        # Classroom students check
        t_classrooms_cursor = db["classrooms"].find({"teacher_id": str(teacher_id)})
        st_emails = []
        async for cl in t_classrooms_cursor:
            for s in cl.get("students", []):
                st_emails.append(s["student_email"])
                
        students = []
        students_cursor = db["users"].find({"role": "student", "email": {"$in": st_emails}})
        async for s in students_cursor:
            students.append(s)
        assert len(students) == 1
        assert students[0]["name"] == "Young Turing"
        
        # Classroom parents check
        parents_teacher = []
        parents_teacher_cursor = db["users"].find({
            "role": "parent",
            "linked_student_emails": {"$in": st_emails}
        })
        async for p in parents_teacher_cursor:
            parents_teacher.append(p)
        assert len(parents_teacher) == 1
        assert parents_teacher[0]["name"] == "Mr. Turing Sr."
        print("[PASS] Test 4: Teacher connections queries resolved successfully.")
        
        # Clean up test data
        await db["users"].delete_many({"email": {"$in": [t_email, s_email, p_email]}})
        await db["classrooms"].delete_many({"class_code": class_code})
        print("[CLEANUP] Deleted test Teacher, Student, Parent, and Classroom.")
        
        print("=" * 60)
        print(">>> ALL PROFILE DATABASE VERIFICATION TESTS PASSED! <<<")
        print("=" * 60)
        
    except AssertionError as ae:
        print(f"\n[FAIL] ASSERTION ERROR: {ae}")
        # Make sure cleanup runs
        await db["users"].delete_many({"email": {"$in": [t_email, s_email, p_email]}})
        await db["classrooms"].delete_many({"class_code": class_code})
        sys.exit(1)
    except Exception as e:
        print(f"\n[FAIL] EXCEPTION OCCURRED: {e}")
        # Make sure cleanup runs
        await db["users"].delete_many({"email": {"$in": [t_email, s_email, p_email]}})
        await db["classrooms"].delete_many({"class_code": class_code})
        sys.exit(1)
    finally:
        await close_mongo_connection()

if __name__ == "__main__":
    asyncio.run(run_profile_tests())
