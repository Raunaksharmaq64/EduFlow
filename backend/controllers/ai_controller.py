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
        api_key = os.getenv("GEMINI_API_KEY")
        if api_key:
            genai.configure(api_key=api_key)
            
        model = genai.GenerativeModel("gemini-2.5-flash")
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
        api_key = os.getenv("GEMINI_API_KEY")
        if api_key:
            genai.configure(api_key=api_key)

        model = genai.GenerativeModel("gemini-2.5-flash")
        
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
        api_key = os.getenv("GEMINI_API_KEY")
        if api_key:
            genai.configure(api_key=api_key)

        model = genai.GenerativeModel("gemini-2.5-flash")
        
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

async def generate_flashcards_ai(topic: str, grade: str, num_cards: int = 5) -> dict:
    if not is_api_key_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Gemini API Key not configured. Please add GEMINI_API_KEY in your backend/.env file."
        )
    
    prompt = f"""
    You are an expert AI Learning assistant. Create active recall flashcards to help a student study.
    - Topic or Source Text: {topic}
    - Grade/Class Level: {grade}
    - Number of Flashcards to generate: {num_cards}
    
    You MUST respond with a valid JSON object matching this schema exactly:
    {{
        "topic": "Brief topic name",
        "grade": "{grade}",
        "flashcards": [
            {{
                "front": "Write the front of the card (question, term, or formula to recall)",
                "back": "Write the back of the card (the answer, explanation, or definition)",
                "explanation": "Brief memory tip or memory hook"
            }}
        ]
    }}
    
    Ensure all flashcards are high quality, accurate, and age-appropriate for {grade}. Keep the content concise and focused.
    """
    
    try:
        api_key = os.getenv("GEMINI_API_KEY")
        if api_key:
            genai.configure(api_key=api_key)

        model = genai.GenerativeModel("gemini-2.5-flash")
        
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        
        cards_data = json.loads(response.text)
        return cards_data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate flashcards from Gemini API: {str(e)}"
        )

async def generate_study_kanban_ai(subject: str, grade: str, weak_topics: list[str], target_goals: str = None) -> dict:
    if not is_api_key_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Gemini API Key not configured. Please add GEMINI_API_KEY in your backend/.env file."
        )
    
    weak_topics_str = ", ".join(weak_topics)
    target_str = f" Target Goal: {target_goals}" if target_goals else ""
    
    prompt = f"""
    You are an expert AI Learning Mentor. 
    Create a study plan consisting of highly practical, step-by-step task action items.
    - Subject: {subject}
    - Grade/Class Level: {grade}
    - Weak Topics to focus on: {weak_topics_str}
    {target_str}
    
    You MUST respond with a valid JSON object matching this schema exactly:
    {{
        "subject": "{subject}",
        "grade": "{grade}",
        "tasks": [
            {{
                "id": "task_1",
                "title": "A short, actionable study task (e.g. Day 1: Read page 20-25 of chemical formulas)",
                "status": "todo"
            }}
        ]
    }}
    
    Provide exactly 6 to 9 tasks. Make sure tasks are concrete, manageable, and sequentially structured.
    """
    
    try:
        api_key = os.getenv("GEMINI_API_KEY")
        if api_key:
            genai.configure(api_key=api_key)

        model = genai.GenerativeModel("gemini-2.5-flash")
        
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        
        kanban_data = json.loads(response.text)
        return kanban_data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate study kanban from Gemini API: {str(e)}"
        )

async def generate_lesson_plan_ai(topic: str, grade: str, weak_topics: list[str] = None, common_misconceptions: str = None) -> str:
    if not is_api_key_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Gemini API Key not configured. Please add GEMINI_API_KEY in your backend/.env file."
        )
    
    weak_str = f"Specific weak points/sub-topics: {', '.join(weak_topics)}." if weak_topics else ""
    misconceptions_str = f"Students doubts trends/misconceptions: {common_misconceptions}." if common_misconceptions else ""
    
    prompt = f"""
    You are an expert curriculum designer and teaching assistant.
    Create a highly engaging, structured lesson plan for a teacher to address class weaknesses.
    - Class Level: {grade}
    - Subject/Topic to review: {topic}
    {weak_str}
    {misconceptions_str}
    
    Please provide the response in a beautiful Markdown format with clear sections:
    1. Overall Class Insights (Summarize what concepts students are struggling with and why)
    2. Core Misconceptions (Clear explanations of what students are confusing, and how the teacher should clarify them)
    3. 50-Minute Lesson Outline (Warmup: 10 mins, Lecture & Demonstration: 20 mins, Group Activity: 15 mins, Exit Ticket/Evaluation: 5 mins)
    4. Remedial Exit Ticket (Include 3 specific multiple-choice or short-answer questions to test comprehension, with answers highlighted for the teacher)
    
    Keep the tone professional, supportive, and practical for classroom use.
    """
    
    try:
        api_key = os.getenv("GEMINI_API_KEY")
        if api_key:
            genai.configure(api_key=api_key)
            
        model = genai.GenerativeModel("gemini-2.5-flash")
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate lesson plan from Gemini API: {str(e)}"
        )

async def generate_parent_revision_guide_ai(topic: str, grade: str, weak_topics: list[str] = None) -> str:
    if not is_api_key_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Gemini API Key not configured. Please add GEMINI_API_KEY in your backend/.env file."
        )
    
    weak_str = f"Other weak areas of the student: {', '.join(weak_topics)}." if weak_topics else ""
    
    prompt = f"""
    You are an expert educational counselor and tutor helping parents support their child's education at home.
    Create a highly practical, encouraging, and parent-friendly Home Revision Companion Guide.
    - Child Grade/Level: {grade}
    - Concept to review: {topic}
    {weak_str}
    
    Please provide the response in a beautiful Markdown format with clear, styled sections:
    1. 💡 Concept Explained Simply (Explain this concept in plain English with simple analogies so a parent can understand and teach it to their child).
    2. ⏱️ 30-Minute Home Revision Plan (Outline a step-by-step interactive study routine, e.g. 5-min warmup discussion, 15-min guided examples, 10-min practice).
    3. 📝 Home Practice Worksheet (Include exactly 3 specific questions for the child to solve. Highlight the correct answers and provide step-by-step solutions for the parent).
    
    Keep the tone extremely supportive, warm, and easy to follow for parents who may not be experts in the subject.
    """
    
    try:
        api_key = os.getenv("GEMINI_API_KEY")
        if api_key:
            genai.configure(api_key=api_key)
            
        model = genai.GenerativeModel("gemini-2.5-flash")
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate parent revision guide from Gemini API: {str(e)}"
        )


