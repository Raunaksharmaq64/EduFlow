import sys
import os

# Add parent path to import backend modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.ai import QuizRequest, FlashcardRequest
from pydantic import ValidationError

def test_limits():
    print("========================================")
    print(">>> RUNNING AI REQUEST LIMIT TESTS <<<")
    print("========================================")

    # 1. Test QuizRequest validation at valid/invalid limits
    print("Testing QuizRequest limits...")
    for count in [1, 5, 20, 30]:
        try:
            req = QuizRequest(topic="Photosynthesis", grade="8th Grade", num_questions=count)
            assert req.num_questions == count
            print(f"[PASS] QuizRequest parsed count {count} successfully.")
        except ValidationError as e:
            print(f"[FAIL] QuizRequest failed to parse valid count {count}: {e}")
            sys.exit(1)

    # Values exceeding limit (e.g. 31) should fail
    try:
        QuizRequest(topic="Photosynthesis", grade="8th Grade", num_questions=31)
        print("[FAIL] QuizRequest accepted invalid count 31!")
        sys.exit(1)
    except ValidationError:
        print("[PASS] QuizRequest successfully rejected invalid count 31.")

    # 2. Test FlashcardRequest validation at valid/invalid limits
    print("\nTesting FlashcardRequest limits...")
    for count in [1, 5, 20, 30]:
        try:
            req = FlashcardRequest(topic="Photosynthesis", grade="8th Grade", num_cards=count)
            assert req.num_cards == count
            print(f"[PASS] FlashcardRequest parsed count {count} successfully.")
        except ValidationError as e:
            print(f"[FAIL] FlashcardRequest failed to parse valid count {count}: {e}")
            sys.exit(1)

    # Values exceeding limit (e.g. 31) should fail
    try:
        FlashcardRequest(topic="Photosynthesis", grade="8th Grade", num_cards=31)
        print("[FAIL] FlashcardRequest accepted invalid count 31!")
        sys.exit(1)
    except ValidationError:
        print("[PASS] FlashcardRequest successfully rejected invalid count 31.")

    print("========================================")
    print(">>> ALL AI LIMIT TESTS PASSED! <<<")
    print("========================================")

if __name__ == "__main__":
    test_limits()
