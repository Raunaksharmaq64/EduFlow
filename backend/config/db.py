import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

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

async def close_mongo_connection():
    if db_instance.client:
        db_instance.client.close()
        print("Closed MongoDB connection")

def get_database():
    return db_instance.db
