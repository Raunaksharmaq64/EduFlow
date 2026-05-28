from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config.db import connect_to_mongo, close_mongo_connection
from routes.auth import router as auth_router
from routes.ai import router as ai_router
from routes.communication import router as communication_router
from routes.assignments import router as assignments_router
from routes.classrooms import router as classrooms_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic: Connect to MongoDB
    await connect_to_mongo()
    
    # User friendly server console logs
    print("\n" + "=" * 60, flush=True)
    print(">>> EduFlow AI Backend Server is RUNNING!", flush=True)
    print(">>> Server URL: http://127.0.0.1:8000", flush=True)
    print(">>> Swagger API Documentation: http://127.0.0.1:8000/docs", flush=True)
    print("=" * 60 + "\n", flush=True)
    
    yield
    # Shutdown logic: Close connection
    await close_mongo_connection()
    # No shutdown logic needed here

app = FastAPI(
    title="EduFlow AI API",
    description="Asynchronous backend API for EduFlow AI Learning Platform",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS for local development (supports hitting API from file:// or localhost)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this in production for security
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(auth_router)
app.include_router(ai_router)
app.include_router(communication_router)
app.include_router(assignments_router)
app.include_router(classrooms_router)


@app.get("/")
async def root():
    return {
        "status": "online",
        "service": "EduFlow AI Backend Service",
        "version": "1.0.0",
        "docs": "/docs"
    }
