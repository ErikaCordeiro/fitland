from typing import Any

from app.models.exercise import Exercise
from app.models.student import Student


class ExerciseContextBuilder:
    @staticmethod
    def build(exercise: Exercise) -> dict[str, Any]:
        return {
            "exercise_id": str(exercise.id),
            "name": exercise.name,
            "muscle_group": exercise.muscle_group,
            "explanation": exercise.explanation,
        }


class PersonalSuggestionContextBuilder:
    @staticmethod
    def build(student: Student, exercises: list[Exercise]) -> dict[str, Any]:
        return {
            "student": {
                "age": student.age,
                "weight": student.weight,
                "height": student.height,
                "objective": student.objective,
                "notes": student.notes,
            },
            "exercise_candidates": [ExerciseContextBuilder.build(item) for item in exercises],
        }


class MealContextBuilder:
    @staticmethod
    def build(*, meal: dict[str, Any]) -> dict[str, Any]:
        allowed = {"meal_id", "name", "items", "nutrition_targets"}
        return {key: value for key, value in meal.items() if key in allowed}


class FoodVisionContextBuilder:
    @staticmethod
    def build(*, student_id: str, meal_name: str | None = None) -> dict[str, Any]:
        return {"student_id": student_id, "meal_name": meal_name}
