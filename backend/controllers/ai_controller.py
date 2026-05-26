import os
import json
import google.generativeai as genai
from dotenv import load_dotenv
from PIL import Image
import io
from fastapi import HTTPException, status

# Load environment variables
load_dotenv()

# We get the API key
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Simple check to see if key is configured
def is_api_key_configured():
    return GEMINI_API_KEY and GEMINI_API_KEY != "your_gemini_api_key_here"

if is_api_key_configured():
    genai.configure(api_key=GEMINI_API_KEY)

async def generate_study_plan_ai(subject: str, grade: str, weak_topics: list[str], target_goals: str = None) -> str:
    if not is_api_key_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Gemini API Key not configured. Please add GEMINI_API_KEY in your backend/.env file."
        )
    
    # Prompt construction
    weak_topics_str = ", ".join(weak_topics)
    target_str = f" Target Goal: {target_goals}" if target_goals else ""
    
    prompt = f"""
    You are an expert AI Learning Mentor for students.
    Create a highly personalized, structured study plan for a student:
    - Subject: {subject}
    - Grade/Class: {grade}
    - Weak Topics to focus on: {weak_topics_str}
    {target_str}
    
    Please provide the response in a beautiful Markdown format with clear sections:
    1. Overall Strategy (Include motivation and a summary of approach)
    2. Weekly Schedule (Break down topics day-by-day or week-by-week)
    3. Practice Guidelines & Tips
    4. Recommended Resources / Practice Types
    
    Keep the language encouraging, clear, and highly practical.
    """
    
    try:
        # Load key dynamically in case it was updated after import
        if not genai.get_api_key():
            genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
            
        model = genai.GenerativeModel("gemini-1.5-flash")
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate study plan from Gemini API: {str(e)}"
        )

async def solve_doubt_ai(question_text: str = None, image_bytes: bytes = None) -> str:
    if not is_api_key_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Gemini API Key not configured. Please add GEMINI_API_KEY in your backend/.env file."
        )
    
    try:
        # Load key dynamically in case it was updated after import
        if not genai.get_api_key():
            genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

        model = genai.GenerativeModel("gemini-1.5-flash")
        
        # Prepare contents
        contents = []
        if image_bytes:
            # Load the image
            image = Image.open(io.BytesIO(image_bytes))
            contents.append(image)
        
        prompt = f"""
        You are a highly helpful and expert academic AI Tutor.
        A student has asked a question/doubt. Solve the problem step-by-step and explain the concepts clearly.
        
        Student's Question: {question_text if question_text else "Please solve the question shown in the image."}
        
        Provide the response in Markdown format. If it's a math or science problem, break down the steps clearly.
        If there is an image, first describe what the problem is in the image, then solve it.
        Keep the explanation friendly, encouraging, and clear.
        """
        contents.append(prompt)
        
        response = model.generate_content(contents)
        return response.text
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to solve doubt using Gemini API: {str(e)}"
        )

async def generate_quiz_ai(topic: str, grade: str, num_questions: int = 5, difficulty: str = "medium") -> dict:
    if not is_api_key_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Gemini API Key not configured. Please add GEMINI_API_KEY in your backend/.env file."
        )
    
    prompt = f"""
    You are an AI Quiz Generator for an educational platform.
    Create a multiple-choice quiz about:
    - Topic: {topic}
    - Grade/Class Level: {grade}
    - Number of Questions: {num_questions}
    - Difficulty: {difficulty}
    
    You MUST respond with a valid JSON object matching this schema exactly:
    {{
        "topic": "{topic}",
        "grade": "{grade}",
        "difficulty": "{difficulty}",
        "questions": [
            {{
                "question_text": "Write the question text here",
                "options": ["Option A", "Option B", "Option C", "Option D"],
                "correct_option": "The correct option from the options list",
                "explanation": "Brief explanation of why this option is correct"
            }}
        ]
    }}
    
    Ensure all questions are high quality, accurate, and age-appropriate for {grade}. The list of options must have exactly 4 choices.
    """
    
    try:
        # Load key dynamically in case it was updated after import
        if not genai.get_api_key():
            genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

        model = genai.GenerativeModel("gemini-1.5-flash")
        
        # Enforce JSON response using generation config
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        
        quiz_data = json.loads(response.text)
        return quiz_data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate quiz from Gemini API: {str(e)}"
        )
