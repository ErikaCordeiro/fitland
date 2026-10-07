import re
import uuid
from datetime import datetime, timedelta
from difflib import SequenceMatcher
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.agenda_event import AgendaEvent
from app.models.meal_plan import MealPlan, MealPlanMeal, MealPlanStatus
from app.models.personal_branding import PersonalBranding
from app.models.progress import ProgressLog
from app.models.student import Student
from app.models.workout import Workout, WorkoutExercise
from app.models.workout_session import WorkoutSession
from app.services.coach.classifier import normalize_text
from app.services.module_registry import resolve_modules


TZ = ZoneInfo("America/Sao_Paulo")
WEEKDAYS = {0: "Segunda", 1: "Terça", 2: "Quarta", 3: "Quinta", 4: "Sexta", 5: "Sábado", 6: "Domingo"}


class CoachDataResolver:
    def __init__(self, db: Session, user):
        self.db = db
        self.user = user
        self.student = db.scalar(select(Student).where(Student.user_id == user.id))
        if not self.student:
            raise ValueError("Student profile required")
        branding = db.scalar(select(PersonalBranding).where(PersonalBranding.personal_id == self.student.personal_id))
        self.modules = resolve_modules((branding.modules if branding else None) or {})

    def module_enabled(self, key: str) -> bool:
        return self.modules.get(key) is True

    def workouts(self) -> list[Workout]:
        if not self.module_enabled("workouts"):
            return []
        query = select(Workout).options(selectinload(Workout.exercises).selectinload(WorkoutExercise.exercise)).where(
            Workout.student_id == self.student.id,
            Workout.personal_id == self.student.personal_id,
        ).order_by(Workout.created_at.desc())
        return list(self.db.scalars(query))

    def workout_from_context(self, context: dict) -> Workout | None:
        try:
            workout_id = uuid.UUID(context.get("last_workout_id", ""))
        except ValueError:
            return None
        return next((row for row in self.workouts() if row.id == workout_id), None)

    def today_workout(self) -> Workout | None:
        return self.workout_for_offset(0)

    def workout_for_offset(self, offset: int) -> Workout | None:
        day = WEEKDAYS[(datetime.now(TZ).weekday() + offset) % 7]
        return next((row for row in self.workouts() if row.day_of_week == day and row.status == "active"), None)

    def next_workout(self, after_offset: int = 0) -> tuple[Workout, int] | None:
        today = (datetime.now(TZ).weekday() + after_offset) % 7
        rows = self.workouts()
        candidates = []
        for row in rows:
            index = next((key for key, value in WEEKDAYS.items() if value == row.day_of_week), None)
            if index is not None:
                delta = (index - today) % 7 or 7
                candidates.append((delta, row))
        if not candidates:
            return None
        delta, workout = min(candidates, key=lambda item: item[0])
        return workout, delta

    def resolve_exercise(self, text: str, context: dict) -> tuple[WorkoutExercise | None, list[WorkoutExercise]]:
        rows = [link for workout in self.workouts() for link in workout.exercises]
        try:
            context_id = uuid.UUID(context.get("last_exercise_id", ""))
        except ValueError:
            context_id = None
        normalized = normalize_text(text)
        candidate_ids = {str(value) for value in context.get("candidate_exercise_ids", [])}
        search_rows = [row for row in rows if str(row.id) in candidate_ids] if candidate_ids else rows
        matches = []
        for row in search_rows:
            name = normalize_text(row.exercise.name)
            words = [word for word in name.split() if len(word) > 3]
            if name in normalized or any(re.search(rf"\b{re.escape(word)}\b", normalized) for word in words):
                matches.append(row)
        if not matches:
            query_words = [word for word in normalized.split() if len(word) > 3 and word not in {"qual", "quanto", "quantas", "carga", "series", "repeticoes", "descanso", "exercicio"}]
            scored = []
            for row in search_rows:
                name_words = normalize_text(row.exercise.name).split()
                score = max((SequenceMatcher(None, query, name).ratio() for query in query_words for name in name_words), default=0)
                if score >= 0.72:
                    scored.append((score, row))
            if scored:
                best = max(score for score, _ in scored)
                matches = [row for score, row in scored if score >= best - 0.05]
        unique = {row.id: row for row in matches}
        matches = list(unique.values())
        if len(matches) == 1:
            return matches[0], matches
        if not matches and context_id:
            contextual = next((row for row in rows if row.id == context_id), None)
            return contextual, [contextual] if contextual else []
        return None, matches

    def recent_sessions(self, limit: int = 3) -> list[WorkoutSession]:
        if not self.module_enabled("workouts"):
            return []
        return list(self.db.scalars(select(WorkoutSession).where(
            WorkoutSession.student_id == self.student.id,
            WorkoutSession.personal_id == self.student.personal_id,
            WorkoutSession.status == "concluido",
        ).order_by(WorkoutSession.completed_at.desc()).limit(limit)))

    def latest_performance(self, exercise: WorkoutExercise) -> dict | None:
        for session in self.recent_sessions(20):
            for item in session.exercises or []:
                if str(item.get("exercise_id")) not in {str(exercise.id), str(exercise.exercise_id)}:
                    continue
                completed = [row for row in item.get("sets", []) if row.get("status") == "concluida"]
                if completed:
                    return {"set": completed[-1], "completed_at": session.completed_at}
        return None

    def today_schedule(self) -> list[AgendaEvent]:
        if not self.module_enabled("calendar"):
            return []
        today = datetime.now(TZ).date()
        return list(self.db.scalars(select(AgendaEvent).where(
            AgendaEvent.personal_id == self.student.personal_id,
            AgendaEvent.student_id == self.student.id,
            AgendaEvent.visible_to_student.is_(True),
            AgendaEvent.event_date == today,
        ).order_by(AgendaEvent.event_time)))

    def current_weight(self) -> float | None:
        if not self.module_enabled("progress"):
            return None
        latest = self.db.scalar(select(ProgressLog).where(
            ProgressLog.student_id == self.student.id,
            ProgressLog.body_weight.is_not(None),
        ).order_by(ProgressLog.log_date.desc(), ProgressLog.created_at.desc()))
        return float(latest.body_weight) if latest else float(self.student.weight) if self.student.weight else None

    def progress_summary(self) -> dict:
        if not self.module_enabled("progress"):
            return {"enabled": False}
        cutoff = datetime.now(TZ).replace(tzinfo=None) - timedelta(days=30)
        sessions = [row for row in self.recent_sessions(100) if row.completed_at and row.completed_at.replace(tzinfo=None) >= cutoff]
        return {"enabled": True, "completed": len(sessions), "last": sessions[0].completed_at if sessions else None, "weight": self.current_weight()}

    def meal_plan(self) -> MealPlan | None:
        if not self.module_enabled("diet"):
            return None
        return self.db.scalar(select(MealPlan).options(selectinload(MealPlan.meals).selectinload(MealPlanMeal.items)).where(
            MealPlan.student_id == self.student.id,
            MealPlan.personal_id == self.student.personal_id,
            MealPlan.status == MealPlanStatus.ACTIVE,
        ))
