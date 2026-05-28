import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

from datetime import datetime, timedelta

# Load environment variables
load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "eduflow")

class Database:
    client: AsyncIOMotorClient = None
    db = None

db_instance = Database()

async def connect_to_mongo():
    db_instance.client = AsyncIOMotorClient(MONGODB_URL)
    db_instance.db = db_instance.client[DATABASE_NAME]
    print(f"Connected to MongoDB: {DATABASE_NAME}")
    
    # Auto-clean system: setup TTL index and startup purges
    try:
        db = db_instance.db
        
        # 1. Create TTL index on notifications (expires after 30 days)
        await db["notifications"].create_index("created_at", expireAfterSeconds=30 * 24 * 60 * 60)
        print("MongoDB: Notification TTL index verified.")
        
        # 2. Delete read notifications older than 7 days
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        delete_result = await db["notifications"].delete_many({
            "read": True,
            "created_at": {"$lt": seven_days_ago}
        })
        if delete_result.deleted_count > 0:
            print(f"MongoDB Clean: Purged {delete_result.deleted_count} read notifications older than 7 days.")
            
    except Exception as e:
        print(f"MongoDB Clean Error during startup: {e}")

async def close_mongo_connection():
    if db_instance.client:
        db_instance.client.close()
        print("Closed MongoDB connection")

def get_database():
    return db_instance.db
