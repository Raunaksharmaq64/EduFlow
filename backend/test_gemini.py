import asyncio
import os
from controllers.ai_controller import generate_study_plan_ai, is_api_key_configured

async def test_gemini():
    print("Checking Gemini API Configuration...")
    if not is_api_key_configured():
        print("ERROR: GEMINI_API_KEY is not configured in backend/.env!")
        print("Please replace 'your_gemini_api_key_here' with a valid key from Google AI Studio.")
        return
    
    print("Gemini API key is configured. Testing connection with a sample study plan request...")
    try:
        plan = await generate_study_plan_ai(
            subject="Science",
            grade="8th Grade",
            weak_topics=["Newton's Laws of Motion", "Friction"],
            target_goals="Understand core concepts for class test"
        )
        print("\n--- TEST SUCCESSFUL! Gemini Response: ---")
        print(plan[:500] + "\n... (truncated)")
    except Exception as e:
        print(f"\nERROR: Failed to call Gemini API: {e}")

if __name__ == "__main__":
    asyncio.run(test_gemini())
