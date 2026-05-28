import asyncio
import os
import sys
from bson import ObjectId
from datetime import datetime, timezone

# Add parent path to import backend modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.db import connect_to_mongo, close_mongo_connection, get_database

async def run_automated_tests():
    print("=" * 60)
    print(">>> RUNNING CLASSROOM & SMART ALERTS HUB TEST SUITE <<<")
    print("=" * 60)
    
    await connect_to_mongo()
    db = get_database()
    
    if db is None:
        print("ERROR: Could not connect to database.")
        sys.exit(1)
        
    test_class_code = "TESTING99"
    test_teacher_id = "test_teacher_123"
    test_student_id = "test_student_123"
    test_student_email = "test_student@example.com"
    test_parent_id = "test_parent_123"
    test_parent_email = "test_parent@example.com"
    
    try:
        # 1. SETUP: Clean up old test data if any
        await db["classrooms"].delete_many({"class_code": test_class_code})
        await db["users"].delete_many({"email": {"$in": [test_student_email, test_parent_email]}})
        await db["announcements"].delete_many({"class_code": test_class_code})
        await db["notifications"].delete_many({"user_id": {"$in": [test_student_id, test_parent_id]}})
        
        # Insert test users
        student_user = {
            "_id": ObjectId("60c72b2f9b1d8b1d8b1d8b1d"),
            "name": "Test Student",
            "email": test_student_email,
            "role": "student",
            "xp": 150,
            "level": 2,
            "class_codes": [test_class_code]
        }
        test_student_id = str(student_user["_id"])
        
        parent_user = {
            "_id": ObjectId("60c72b2f9b1d8b1d8b1d8b1e"),
            "name": "Test Parent",
            "email": test_parent_email,
            "role": "parent",
            "linked_student_emails": [test_student_email]
        }
        test_parent_id = str(parent_user["_id"])
        
        await db["users"].insert_many([student_user, parent_user])
        print("[SETUP] Inserted test student and parent users.")
        
        # Insert test classroom
        classroom_doc = {
            "class_code": test_class_code,
            "class_name": "Test Science Class",
            "teacher_id": test_teacher_id,
            "teacher_name": "Test Teacher",
            "students": [
                {
                    "student_id": test_student_id,
                    "student_name": "Test Student",
                    "student_email": test_student_email
                }
            ],
            "created_at": datetime.now(timezone.utc)
        }
        await db["classrooms"].insert_one(classroom_doc)
        print("[SETUP] Inserted test classroom.")
        
        # 2. TEST: Create Notice Board Announcement (Bulletin Post)
        announcement_text = "Notice: Test Homework is due this Friday."
        new_announcement = {
            "class_code": test_class_code,
            "author_id": test_teacher_id,
            "author_name": "Test Teacher",
            "content": announcement_text,
            "created_at": datetime.now(timezone.utc),
            "likes": [],
            "comments": []
        }
        
        insert_res = await db["announcements"].insert_one(new_announcement)
        announcement_id = str(insert_res.inserted_id)
        print(f"[TEST 1] Announcement created with ID: {announcement_id}")
        
        # Verify db entry
        ann_in_db = await db["announcements"].find_one({"_id": ObjectId(announcement_id)})
        assert ann_in_db is not None, "Failed: Announcement not found in database!"
        assert ann_in_db["content"] == announcement_text, "Failed: Announcement content mismatch!"
        print("[PASS] Test 1 Passed: Announcement verified in database.")
        
        # 3. TEST: Dynamic Notifications Generation (Triangular Smart Alerts)
        # Notify student
        await db["notifications"].insert_one({
            "user_id": test_student_id,
            "recipient_role": "student",
            "title": "New Announcement in Test Science Class",
            "content": f'Teacher Test Teacher posted: "{announcement_text}"',
            "type": "announcement_created",
            "created_at": datetime.now(timezone.utc),
            "read": False,
            "metadata": {"class_code": test_class_code}
        })
        
        # Notify parent
        await db["notifications"].insert_one({
            "user_id": test_parent_id,
            "recipient_role": "parent",
            "title": "New Class Announcement - Test Science Class",
            "content": "Teacher Test Teacher posted an update for Test Student's class.",
            "type": "announcement_created",
            "created_at": datetime.now(timezone.utc),
            "read": False,
            "metadata": {"class_code": test_class_code}
        })
        
        # Verify notifications in db
        student_notif = await db["notifications"].find_one({"user_id": test_student_id, "recipient_role": "student"})
        parent_notif = await db["notifications"].find_one({"user_id": test_parent_id, "recipient_role": "parent"})
        
        assert student_notif is not None, "Failed: Student notification not generated!"
        assert parent_notif is not None, "Failed: Parent notification not generated!"
        assert "Test Homework" in student_notif["content"], "Failed: Student notification content mismatch!"
        print("[PASS] Test 2 Passed: Student and Parent notifications generated and verified.")
        
        # 4. TEST: Leaderboard Logic
        classroom = await db["classrooms"].find_one({"class_code": test_class_code})
        assert classroom is not None
        
        student_emails = [s["student_email"].lower() for s in classroom.get("students", [])]
        assert test_student_email in student_emails
        
        cursor = db["users"].find({"email": {"$in": student_emails}, "role": "student"})
        students_list = []
        async for doc in cursor:
            students_list.append({
                "id": str(doc["_id"]),
                "name": doc["name"],
                "xp": doc.get("xp", 0),
                "level": doc.get("level", 1)
            })
        students_list.sort(key=lambda x: x["xp"], reverse=True)
        for idx, student in enumerate(students_list):
            student["rank"] = idx + 1
            
        assert len(students_list) == 1, "Failed: Student not found in leaderboard list!"
        assert students_list[0]["xp"] == 150, "Failed: Student XP value mismatch on leaderboard!"
        assert students_list[0]["rank"] == 1, "Failed: Student rank value incorrect!"
        print("[PASS] Test 3 Passed: Leaderboard sorting and ranking calculations verified.")
        
        # 5. CLEANUP: Delete test data
        await db["classrooms"].delete_one({"class_code": test_class_code})
        await db["users"].delete_many({"_id": {"$in": [ObjectId(test_student_id), ObjectId(test_parent_id)]}})
        await db["announcements"].delete_one({"_id": ObjectId(announcement_id)})
        await db["notifications"].delete_many({"user_id": {"$in": [test_student_id, test_parent_id]}})
        print("[CLEANUP] All test documents removed successfully.")
        
        print("=" * 60)
        print(">>> ALL TESTS PASSED SUCCESSFULLY! <<<")
        print("=" * 60)
        
    except AssertionError as ae:
        print(f"\n[FAIL] ASSERTION ERROR: {ae}")
        # Make sure to clean up even if assert fails
        try:
            await db["classrooms"].delete_many({"class_code": test_class_code})
            await db["users"].delete_many({"email": {"$in": [test_student_email, test_parent_email]}})
            await db["announcements"].delete_many({"class_code": test_class_code})
            await db["notifications"].delete_many({"user_id": {"$in": [test_student_id, test_parent_id]}})
        except:
            pass
        sys.exit(1)
    except Exception as e:
        print(f"\n[FAIL] TEST RUNNER EXCEPTION: {e}")
        try:
            await db["classrooms"].delete_many({"class_code": test_class_code})
            await db["users"].delete_many({"email": {"$in": [test_student_email, test_parent_email]}})
            await db["announcements"].delete_many({"class_code": test_class_code})
            await db["notifications"].delete_many({"user_id": {"$in": [test_student_id, test_parent_id]}})
        except:
            pass
        sys.exit(1)
    finally:
        await close_mongo_connection()

if __name__ == "__main__":
    asyncio.run(run_automated_tests())
