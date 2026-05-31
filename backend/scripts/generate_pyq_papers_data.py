import os
import json
import asyncio
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
else:
    raise ValueError("GEMINI_API_KEY is not configured in backend/.env file.")

async def generate_section_a(subject, year):
    prompt = f"""
    You are an expert CBSE/NCERT examiner and question paper designer.
    Create Section A (Multiple Choice Questions) for CBSE Class 10 {subject} Board Paper for the year {year}.
    This section must contain exactly 20 Multiple Choice Questions (1 mark each).
    All questions must be highly high-quality, authentic to the official CBSE board style and syllabus, and cover actual topics.
    
    You MUST respond with a valid JSON array matching this schema exactly:
    [
        {{
            "id": "{subject.lower()[:3]}_{year}_q1",
            "question_text": "...",
            "question_type": "mcq",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correct_option": "The correct option from the options list",
            "marks": 1,
            "topic": "Syllabus topic name"
        }}
    ]
    """
    model = genai.GenerativeModel("gemini-2.5-flash")
    response = await asyncio.to_thread(
        model.generate_content,
        prompt,
        generation_config={"response_mime_type": "application/json"}
    )
    return json.loads(response.text)

async def generate_sections_other(subject, year):
    pattern_desc = ""
    if subject == "Science":
        pattern_desc = """
        - Section B: 6 Very Short Answer questions (2 marks each, question ids: sci_{year}_q21 to sci_{year}_q26)
        - Section C: 7 Short Answer questions (3 marks each, question ids: sci_{year}_q27 to sci_{year}_q33)
        - Section D: 3 Long Answer questions (5 marks each, question ids: sci_{year}_q34 to sci_{year}_q36)
        - Section E: 3 Case-Based questions (4 marks each, question ids: sci_{year}_q37 to sci_{year}_q39)
        """
    else: # Mathematics
        pattern_desc = """
        - Section B: 5 Very Short Answer questions (2 marks each, question ids: mat_{year}_q21 to mat_{year}_q25)
        - Section C: 6 Short Answer questions (3 marks each, question ids: mat_{year}_q26 to mat_{year}_q31)
        - Section D: 4 Long Answer questions (5 marks each, question ids: mat_{year}_q32 to mat_{year}_q35)
        - Section E: 3 Case-Based questions (4 marks each, question ids: mat_{year}_q36 to mat_{year}_q38)
        """
        
    prompt = f"""
    You are an expert CBSE/NCERT examiner and question paper designer.
    Create Sections B, C, D, and E for CBSE Class 10 {subject} Board Paper for the year {year}.
    It must follow this exact question distribution and marks structure:
    {pattern_desc}
    
    All questions must be highly authentic, realistic to actual past board papers, and cover key syllabus topics (e.g. "Chemical Reactions and Equations", "Quadratic Equations", "Electricity", "Trigonometry", "Arithmetic Progressions").
    For Section E (Case-Based), provide a case study passage or description followed by the sub-questions.
    Every question must include a detailed, correct model answer/solution (`model_answer`).
    
    You MUST respond with a valid JSON array of sections matching this schema exactly:
    [
        {{
            "section_name": "Section B: Very Short Answer Questions",
            "questions": [
                {{
                    "id": "{subject.lower()[:3]}_{year}_q21",
                    "question_text": "...",
                    "question_type": "short",
                    "marks": 2,
                    "model_answer": "...",
                    "topic": "Syllabus topic name"
                }}
            ]
        }},
        ... (one section object for each of Section B, C, D, E)
    ]
    """
    model = genai.GenerativeModel("gemini-2.5-flash")
    response = await asyncio.to_thread(
        model.generate_content,
        prompt,
        generation_config={"response_mime_type": "application/json"}
    )
    return json.loads(response.text)

async def generate_and_save():
    years = [2023, 2022, 2021, 2020, 2019]
    subjects = ["Science", "Mathematics"]
    
    output_file = os.path.join(os.path.dirname(__file__), "cbse_papers_seeded.json")
    all_papers = []
    
    if os.path.exists(output_file):
        try:
            with open(output_file, 'r', encoding='utf-8') as f:
                all_papers = json.load(f)
                print(f"Loaded {len(all_papers)} existing papers from JSON file.")
        except Exception:
            pass
            
    existing_keys = {f"{p['subject']}_{p['year']}" for p in all_papers}
    
    for subject in subjects:
        for year in years:
            key = f"{subject}_{year}"
            if key in existing_keys:
                print(f"Skipping {subject} {year} - already generated.")
                continue
                
            print(f"\n--- Starting generation for {subject} {year} ---")
            try:
                sec_a = await generate_section_a(subject, year)
                print(f"Generated Section A (MCQs) for {subject} {year}.")
                await asyncio.sleep(6) # sleep to stay clean of rate limits
                
                other_sections = await generate_sections_other(subject, year)
                print(f"Generated Sections B-E for {subject} {year}.")
                await asyncio.sleep(6) # sleep to stay clean of rate limits
                
                # Assemble
                sections = [
                    {
                        "section_name": "Section A: Multiple Choice Questions",
                        "questions": sec_a
                    }
                ] + other_sections
                
                # Fix question IDs to match their indices just in case
                for idx, q in enumerate(sections[0]["questions"]):
                    q["id"] = f"{subject.lower()[:3]}_{year}_q{idx+1}"
                
                paper = {
                    "year": year,
                    "subject": subject,
                    "grade": "10th Grade",
                    "exam_title": f"CBSE Class 10 {subject} Board Paper {year}",
                    "sections": sections
                }
                
                all_papers.append(paper)
                # Write after each paper to prevent losing progress
                with open(output_file, 'w', encoding='utf-8') as f:
                    json.dump(all_papers, f, indent=4, ensure_ascii=False)
                print(f"Saved {subject} {year} successfully.")
                
            except Exception as e:
                print(f"ERROR generating {subject} {year}: {e}")
                
if __name__ == "__main__":
    asyncio.run(generate_and_save())
