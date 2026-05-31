import os
import json
import warnings
warnings.filterwarnings("ignore", category=FutureWarning)
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

async def solve_doubt_ai(question_text: str = None, image_bytes: bytes = None, tutor_persona: str = None) -> str:
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
        
        # Choose teaching instructions based on Tutor Persona
        if tutor_persona == "socratic":
            persona_instruction = (
                "You are a Socratic tutor. Do NOT give the direct answer to the doubt. "
                "Instead, explain the concepts and ask guiding questions to lead the student "
                "to find the answer themselves step-by-step. Keep it encouraging."
            )
        elif tutor_persona == "analogy":
            persona_instruction = (
                "You are an Analogy Master tutor. Explain complex science or mathematical "
                "concepts using simple everyday analogies, stories, and comparisons that are easy to relate to."
            )
        elif tutor_persona == "exam":
            persona_instruction = (
                "You are an Exam Drill Coach. Explain concepts concisely using structured "
                "bullet points, formula highlights, and tips for scoring high in board and school exams."
            )
        else:
            persona_instruction = "You are a highly helpful and expert academic AI Tutor. Solve the problem step-by-step and explain the concepts clearly."
        
        prompt = f"""
        {persona_instruction}
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

async def generate_quiz_ai(topic: str, grade: str, num_questions: int = 5, difficulty: str = "medium", question_type: str = "mixed") -> dict:
    if not is_api_key_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Gemini API Key not configured. Please add GEMINI_API_KEY in your backend/.env file."
        )
    
    # Customize Gemini prompt instructions based on selected question type
    if question_type == "mcq":
        type_instruction = "Create multiple-choice questions (MCQs) with exactly 4 options each."
    elif question_type == "tf":
        type_instruction = "Create True/False statements. For these, the 'options' field MUST be exactly ['True', 'False']."
    elif question_type == "fill":
        type_instruction = "Create Fill in the Blanks questions where the question_text contains a blank '________'. The 'options' field must contain 4 candidate words to fill the blank, and the 'correct_option' must be the exact correct word."
    else:
        type_instruction = "Create a mix of Multiple Choice (MCQ), True/False (with options ['True', 'False']), and Fill in the Blanks (with '________' in question text and 4 choices in options)."

    prompt = f"""
    You are an AI Quiz Generator for an educational platform.
    Create a quiz about:
    - Topic: {topic}
    - Grade/Class Level: {grade}
    - Number of Questions: {num_questions}
    - Difficulty: {difficulty}
    
    {type_instruction}
    
    You MUST respond with a valid JSON object matching this schema exactly:
    {{
        "topic": "{topic}",
        "grade": "{grade}",
        "difficulty": "{difficulty}",
        "questions": [
            {{
                "question_text": "Write the question text here",
                "options": ["Choice 1", "Choice 2", "Choice 3", "Choice 4"],
                "correct_option": "The correct option from the options list",
                "explanation": "Brief explanation of why this option is correct",
                "question_type": "mcq, tf, or fill (depending on this specific question format)"
            }}
        ]
    }}
    
    Ensure all questions are high quality, accurate, and age-appropriate for {grade}. 
    For MCQ and Fill-in-the-blank questions, provide exactly 4 options. For True/False questions, provide exactly 2 options: ["True", "False"].
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


async def generate_pyq_exam_ai(
    grade: str,
    subject: str,
    pattern_type: str,
    num_mcq: int = 0,
    num_short: int = 0,
    num_long: int = 0,
    pattern_text: str = None,
    image_bytes: bytes = None
) -> dict:
    if not is_api_key_configured():
        raise HTTPException(
            status_code=status.HTTP_533_SERVICE_UNAVAILABLE,
            detail="Gemini API Key not configured. Please add GEMINI_API_KEY in your backend/.env file."
        )
    
    contents = []
    
    if pattern_type == "upload" and image_bytes:
        try:
            image = Image.open(io.BytesIO(image_bytes))
            contents.append(image)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid image file uploaded: {str(e)}"
            )

    # Enforce a minimum balanced total of exactly 30 questions
    total_q = num_mcq + num_short + num_long
    if total_q < 30:
        if total_q == 0:
            num_mcq = 15
            num_short = 10
            num_long = 5
        else:
            # Scale proportionally to reach exactly 30 questions
            factor = 30.0 / total_q
            num_mcq = max(0, int(round(num_mcq * factor)))
            num_short = max(0, int(round(num_short * factor)))
            num_long = max(0, int(round(num_long * factor)))
            
            # Adjust rounding differences
            new_total = num_mcq + num_short + num_long
            if new_total < 30:
                diff = 30 - new_total
                num_mcq += diff
            elif new_total > 30:
                diff = new_total - 30
                if num_mcq >= diff:
                    num_mcq -= diff
                elif num_short >= diff:
                    num_short -= diff
                else:
                    num_long -= diff

    pattern_instruction = ""
    if pattern_type == "cbse_curriculum":
        if subject.lower() == "science":
            pattern_instruction = (
                "You must construct a complete, authentic 80-mark Class 10 Science question paper conforming to the latest official CBSE curriculum pattern. "
                "The paper MUST contain exactly 39 questions divided into 5 sections as follows:\n"
                "- Section A: 20 Multiple Choice Questions (MCQs) carrying 1 mark each (ids: sci_gen_q1 to sci_gen_q20).\n"
                "- Section B: 6 Very Short Answer (VSA) questions carrying 2 marks each (ids: sci_gen_q21 to sci_gen_q26).\n"
                "- Section C: 7 Short Answer (SA) questions carrying 3 marks each (ids: sci_gen_q27 to sci_gen_q33).\n"
                "- Section D: 3 Long Answer (LA) questions carrying 5 marks each (ids: sci_gen_q34 to sci_gen_q36).\n"
                "- Section E: 3 Case-Based questions carrying 4 marks each (ids: sci_gen_q37 to sci_gen_q39).\n"
                "Provide correct options for Section A and detailed model answers for Sections B, C, D, and E."
            )
        else: # Mathematics
            pattern_instruction = (
                "You must construct a complete, authentic 80-mark Class 10 Mathematics question paper conforming to the latest official CBSE curriculum pattern. "
                "The paper MUST contain exactly 38 questions divided into 5 sections as follows:\n"
                "- Section A: 20 Multiple Choice Questions (MCQs) carrying 1 mark each (ids: mat_gen_q1 to mat_gen_q20).\n"
                "- Section B: 5 Very Short Answer (VSA) questions carrying 2 marks each (ids: mat_gen_q21 to mat_gen_q25).\n"
                "- Section C: 6 Short Answer (SA) questions carrying 3 marks each (ids: mat_gen_q26 to mat_gen_q31).\n"
                "- Section D: 4 Long Answer (LA) questions carrying 5 marks each (ids: mat_gen_q32 to mat_gen_q35).\n"
                "- Section E: 3 Case-Based questions carrying 4 marks each (ids: mat_gen_q36 to mat_gen_q38).\n"
                "Provide correct options for Section A and detailed model answers for Sections B, C, D, and E."
            )
    elif pattern_type == "manual":
        pattern_instruction = f"Generate exactly: {num_mcq} MCQs (1 mark each), {num_short} Short Answer questions (3 marks each), and {num_long} Long Answer questions (5 marks each)."
    elif pattern_type == "text":
        pattern_instruction = (
            f"Analyze the following previous year paper text/description and replicate its question count, types, and mark distribution: {pattern_text}\n"
            "CRITICAL: If the input pattern specifies or results in fewer than 30 questions in total, you MUST pad and scale the paper to contain EXACTLY 30 questions in total (e.g. 15 MCQs, 10 Short, 5 Long), maintaining a balanced and standard exam structure."
        )
    elif pattern_type == "upload":
        pattern_instruction = (
            "Analyze the uploaded previous year paper image. Replicate its question count, types (MCQs, short answer, long answer), and mark distribution.\n"
            "CRITICAL: If the image pattern contains fewer than 30 questions in total, you MUST pad and scale the paper to contain EXACTLY 30 questions in total (e.g. 15 MCQs, 10 Short, 5 Long), maintaining a balanced and standard exam structure."
        )
    
    prompt = f"""
    You are an expert CBSE/NCERT examiner and question paper designer.
    Create a complete practice question paper for:
    - Grade/Class: {grade}
    - Subject: {subject}
    
    {pattern_instruction}
    
    Guidelines:
    1. Ensure all questions are high quality, cover key chapters in the syllabus, and match the difficulty of standard board exams.
    2. Tag each question with a specific topic name from the syllabus (e.g. "Chemical Reactions and Equations", "Quadratic Equations", "Electricity", "Trigonometry", "Arithmetic Progressions"). This is critical for progress tracking!
    3. Include a detailed, correct model answer/solution (`model_answer`) for short and long answer questions, and the `correct_option` for MCQs.
    
    You MUST respond with a valid JSON object matching this schema exactly:
    {{
        "exam_title": "e.g. CBSE Class 10 Science Practice Paper",
        "subject": "{subject}",
        "grade": "{grade}",
        "sections": [
            {{
                "section_name": "Section A: Multiple Choice Questions",
                "questions": [
                    {{
                        "id": "q_1",
                        "question_text": "Write the question text here",
                        "question_type": "mcq",
                        "options": ["Option A", "Option B", "Option C", "Option D"],
                        "correct_option": "The correct option from the options list",
                        "marks": 1,
                        "topic": "Syllabus topic name"
                    }}
                ]
            }},
            {{
                "section_name": "Section B: Short Answer Questions",
                "questions": [
                    {{
                        "id": "q_5",
                        "question_text": "Write short answer question here",
                        "question_type": "short",
                        "marks": 3,
                        "model_answer": "Complete detail answer/solution",
                        "topic": "Syllabus topic name"
                    }}
                ]
            }},
            {{
                "section_name": "Section C: Long Answer Questions",
                "questions": [
                    {{
                        "id": "q_7",
                        "question_text": "Write long answer question here",
                        "question_type": "long",
                        "marks": 5,
                        "model_answer": "Complete comprehensive solution",
                        "topic": "Syllabus topic name"
                    }}
                ]
            }}
        ]
    }}
    """
    contents.append(prompt)
    
    try:
        api_key = os.getenv("GEMINI_API_KEY")
        if api_key:
            genai.configure(api_key=api_key)
            
        model = genai.GenerativeModel("gemini-2.5-flash")
        response = model.generate_content(
            contents,
            generation_config={"response_mime_type": "application/json"}
        )
        return json.loads(response.text)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate exam from Gemini API: {str(e)}"
        )


async def evaluate_pyq_exam_ai(
    sections: list,
    student_answers: dict
) -> dict:
    if not is_api_key_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Gemini API Key not configured. Please add GEMINI_API_KEY in your backend/.env file."
        )
    
    prompt = f"""
    You are an expert CBSE/NCERT evaluator. Grade the student's exam sheet.
    
    Here are the exam sections and questions:
    {json.dumps(sections)}
    
    Here are the student's submitted answers:
    {json.dumps(student_answers)}
    
    Evaluation Rules:
    1. For MCQs (question_type = "mcq"), compare the student's answer to the correct_option. If it matches exactly, award full marks (1 mark). Otherwise, award 0.
    2. For Short/Long answer questions, grade their written answer out of the allocated marks based on accuracy, key terms, and clarity. Provide constructive feedback/rubric review.
    3. Calculate the overall total_score, max_score, and percentage.
    4. Isolate the students' strengths (topics where they scored well) and weaknesses (topics where they struggled).
    
    You MUST respond with a valid JSON object matching this schema exactly:
    {{
        "total_score": 45,
        "max_score": 80,
        "percentage": 56.25,
        "feedback": "Overall exam feedback comment...",
        "results": [
            {{
                "question_id": "q_1",
                "question_text": "...",
                "student_answer": "...",
                "correct_answer": "...",
                "score": 1,
                "max_score": 1,
                "is_correct": true,
                "feedback": "..."
            }}
        ],
        "strengths": ["Topic A", "Topic B"],
        "weaknesses": ["Topic C", "Topic D"]
    }}
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
        return json.loads(response.text)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to evaluate exam from Gemini API: {str(e)}"
        )



