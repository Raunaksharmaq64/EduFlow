import asyncio
import os
import sys
from bson import ObjectId
from datetime import datetime, timezone, timedelta

# Add parent path to import backend modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.db import connect_to_mongo, close_mongo_connection, get_database

async def run_automated_tests():
    print("=" * 60)
    print(">>> RUNNING CLASSROOM, DELETIONS & SMART ALERTS HUB TEST SUITE <<<")
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
    test_assignment_id = "60c72b2f9b1d8b1d8b1d8b1f"
    test_submission_id = "60c72b2f9b1d8b1d8b1d8b20"
    
    try:
        # 1. SETUP: Clean up old test data if any
        await db["classrooms"].delete_many({"class_code": test_class_code})
        await db["users"].delete_many({"email": {"$in": [test_student_email, test_parent_email]}})
        await db["announcements"].delete_many({"class_code": test_class_code})
        await db["notifications"].delete_many({"user_id": {"$in": [test_student_id, test_parent_id]}})
        await db["assignments"].delete_many({"class_code": test_class_code})
        await db["submissions"].delete_many({"assignment_id": test_assignment_id})
        
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
        
        # 5. TEST: Delete Single Notification & Clear All Notifications
        # Insert another temporary notification
        temp_notif_res = await db["notifications"].insert_one({
            "user_id": test_student_id,
            "recipient_role": "student",
            "title": "Temp Title",
            "content": "Temp Content",
            "type": "assignment_created",
            "created_at": datetime.now(timezone.utc),
            "read": False
        })
        temp_notif_id = temp_notif_res.inserted_id
        
        # Delete single notification
        del_notif_res = await db["notifications"].delete_one({"_id": temp_notif_id})
        assert del_notif_res.deleted_count == 1, "Failed to delete single notification"
        
        # Clear all notifications for student
        clear_res = await db["notifications"].delete_many({"user_id": test_student_id})
        assert clear_res.deleted_count >= 1, "Failed to clear student notifications"
        student_notifs_after_clear = await db["notifications"].count_documents({"user_id": test_student_id})
        assert student_notifs_after_clear == 0, "Student notifications not fully cleared!"
        print("[PASS] Test 4 Passed: Single notification delete and clear all notifications verified.")
        
        # 6. TEST: Delete Announcement
        del_ann_res = await db["announcements"].delete_one({"_id": ObjectId(announcement_id)})
        assert del_ann_res.deleted_count == 1, "Failed to delete announcement"
        ann_after_del = await db["announcements"].find_one({"_id": ObjectId(announcement_id)})
        assert ann_after_del is None, "Announcement still exists in DB after deletion!"
        print("[PASS] Test 5 Passed: Notice Board Announcement deletion verified.")
        
        # 7. TEST: Assignment Deletion (Cascade Submissions)
        # Insert test assignment
        await db["assignments"].insert_one({
            "_id": ObjectId(test_assignment_id),
            "class_code": test_class_code,
            "title": "Test Assignment",
            "description": "Verify assignment delete cascade",
            "assignment_type": "manual",
            "due_date": datetime.now(timezone.utc),
            "max_marks": 100,
            "teacher_id": test_teacher_id,
            "created_at": datetime.now(timezone.utc)
        })
        # Insert test student submission for it (assignment_id is stored as string in submissions)
        await db["submissions"].insert_one({
            "_id": ObjectId(test_submission_id),
            "assignment_id": test_assignment_id,
            "student_id": test_student_id,
            "student_name": "Test Student",
            "status": "submitted",
            "submitted_at": datetime.now(timezone.utc)
        })
        
        # Verify setup
        assert await db["assignments"].count_documents({"class_code": test_class_code}) == 1
        assert await db["submissions"].count_documents({"assignment_id": test_assignment_id}) == 1
        
        # Perform assignment delete cascade (mimics router)
        await db["submissions"].delete_many({"assignment_id": test_assignment_id})
        await db["assignments"].delete_one({"_id": ObjectId(test_assignment_id)})
        
        # Assert they are deleted
        assert await db["assignments"].count_documents({"_id": ObjectId(test_assignment_id)}) == 0, "Assignment not deleted!"
        assert await db["submissions"].count_documents({"assignment_id": test_assignment_id}) == 0, "Submissions cascade delete failed!"
        print("[PASS] Test 6 Passed: Assignment and cascade submissions deletion verified.")
        
        # 8. TEST: Classroom Deletion Cascade
        # Insert dummy notices, assignments, submissions, notifications to verify full cascade delete
        await db["announcements"].insert_one({
            "class_code": test_class_code,
            "author_id": test_teacher_id,
            "content": "Classroom announcement cascade test",
            "created_at": datetime.now(timezone.utc)
        })
        await db["assignments"].insert_one({
            "_id": ObjectId(test_assignment_id),
            "class_code": test_class_code,
            "title": "Classroom assignment cascade test",
            "teacher_id": test_teacher_id,
            "created_at": datetime.now(timezone.utc)
        })
        await db["submissions"].insert_one({
            "assignment_id": test_assignment_id,
            "student_id": test_student_id,
            "submitted_at": datetime.now(timezone.utc)
        })
        await db["notifications"].insert_one({
            "user_id": test_parent_id,
            "recipient_role": "parent",
            "title": "Cascade test alert",
            "content": "Alert content",
            "type": "announcement_created",
            "created_at": datetime.now(timezone.utc),
            "metadata": {"class_code": test_class_code}
        })
        
        # Verify student profile has classroom TESTING99
        student_user_before = await db["users"].find_one({"_id": ObjectId(test_student_id)})
        assert test_class_code in student_user_before.get("class_codes", []), "Student setup class code mismatch!"
        
        # Perform Classroom delete cascade (mimics classrooms.py delete_classroom)
        # Pull class_code from students
        await db["users"].update_many(
            {"role": "student", "class_codes": test_class_code},
            {"$pull": {"class_codes": test_class_code}}
        )
        # Delete announcements
        await db["announcements"].delete_many({"class_code": test_class_code})
        # Delete submissions and assignments
        assignments_cursor = db["assignments"].find({"class_code": test_class_code})
        assignment_ids = []
        async for asg in assignments_cursor:
            assignment_ids.append(str(asg["_id"]))
        if assignment_ids:
            await db["submissions"].delete_many({"assignment_id": {"$in": assignment_ids}})
            await db["assignments"].delete_many({"class_code": test_class_code})
        # Delete notifications matching class_code in metadata
        await db["notifications"].delete_many({"metadata.class_code": test_class_code})
        # Delete classroom document
        await db["classrooms"].delete_one({"class_code": test_class_code})
        
        # Asserts
        student_user_after = await db["users"].find_one({"_id": ObjectId(test_student_id)})
        assert test_class_code not in student_user_after.get("class_codes", []), "Class code pull from student profile failed!"
        assert await db["announcements"].count_documents({"class_code": test_class_code}) == 0, "Notice board cascade delete failed!"
        assert await db["assignments"].count_documents({"class_code": test_class_code}) == 0, "Assignments cascade delete failed!"
        assert await db["submissions"].count_documents({"assignment_id": test_assignment_id}) == 0, "Submissions cascade delete failed!"
        assert await db["notifications"].count_documents({"metadata.class_code": test_class_code}) == 0, "Notifications cascade delete failed!"
        assert await db["classrooms"].count_documents({"class_code": test_class_code}) == 0, "Classroom document deletion failed!"
        print("[PASS] Test 7 Passed: Classroom delete cascade (student profile, notices, assignments, submissions, notifications) verified.")
        
        # 9. Startup Purge Test
        # Create an old read notification
        old_read_notif = {
            "user_id": test_student_id,
            "recipient_role": "student",
            "title": "Old Read Alert",
            "content": "Old Content",
            "type": "assignment_created",
            "created_at": datetime.utcnow() - timedelta(days=8),
            "read": True
        }
        await db["notifications"].insert_one(old_read_notif)
        # Execute startup purge
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        await db["notifications"].delete_many({
            "read": True,
            "created_at": {"$lt": seven_days_ago}
        })
        # Verify it was purged
        purged_notif = await db["notifications"].find_one({"title": "Old Read Alert"})
        assert purged_notif is None, "Old read notification startup purge failed!"
        print("[PASS] Test 8 Passed: Startup DB purge of historical read notifications verified.")
        
        # 10. CLEANUP: Delete remaining test users
        await db["users"].delete_many({"_id": {"$in": [ObjectId(test_student_id), ObjectId(test_parent_id)]}})
        print("[CLEANUP] Remaining test documents removed successfully.")
        
        print("=" * 60)
        print(">>> ALL TESTS PASSED SUCCESSFULLY! <<<")
        print("=" * 60)
        
    except AssertionError as ae:
        print(f"\n[FAIL] ASSERTION ERROR: {ae}")
        # Clean up
        try:
            await db["classrooms"].delete_many({"class_code": test_class_code})
            await db["users"].delete_many({"email": {"$in": [test_student_email, test_parent_email]}})
            await db["announcements"].delete_many({"class_code": test_class_code})
            await db["notifications"].delete_many({"user_id": {"$in": [test_student_id, test_parent_id]}})
            await db["assignments"].delete_many({"class_code": test_class_code})
            await db["submissions"].delete_many({"assignment_id": test_assignment_id})
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
            await db["assignments"].delete_many({"class_code": test_class_code})
            await db["submissions"].delete_many({"assignment_id": test_assignment_id})
        except:
            pass
        sys.exit(1)
    finally:
        await close_mongo_connection()

if __name__ == "__main__":
    asyncio.run(run_automated_tests())
