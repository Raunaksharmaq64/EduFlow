from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, status
from backend.models.user import UserCreate, UserLogin, UserResponse, Token
from backend.config.db import get_database
from backend.controllers.auth_controller import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def signup(user_data: UserCreate):
    db = get_database()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection not initialized"
        )
    
    # Convert email to lowercase to prevent duplicates
    email_lower = user_data.email.lower()
    
    # Check if email already exists
    existing_user = await db["users"].find_one({"email": email_lower})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Hash the password
    hashed_pwd = hash_password(user_data.password)
    
    # Prepare user doc
    new_user = {
        "name": user_data.name,
        "email": email_lower,
        "role": user_data.role,
        "password": hashed_pwd,
        "created_at": datetime.utcnow()
    }
    
    result = await db["users"].insert_one(new_user)
    
    # Get created user
    created_user = await db["users"].find_one({"_id": result.inserted_id})
    created_user["id"] = str(created_user["_id"])
    return created_user

@router.post("/login", response_model=Token)
async def login(login_data: UserLogin):
    db = get_database()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection not initialized"
        )
        
    email_lower = login_data.email.lower()
    user = await db["users"].find_one({"email": email_lower})
    
    if not user or not verify_password(login_data.password, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # Create token
    access_token = create_access_token(data={"sub": user["email"], "role": user["role"]})
    
    user["id"] = str(user["_id"])
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user
