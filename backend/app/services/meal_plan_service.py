import uuid

from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.orm import Session, selectinload

from app.models.meal_plan import MealPlan, MealPlanItem, MealPlanMeal, MealPlanStatus
from app.models.student import Student
from app.models.user import User, UserRole
from app.schemas.meal_plan import MealPlanWrite
from app.services.access import get_owned_student


def _student_for_user(db: Session, user: User, student_id: uuid.UUID | None = None) -> Student:
    if user.role == UserRole.STUDENT:
        student = db.scalar(select(Student).where(Student.user_id == user.id))
        if not student:
            raise HTTPException(status_code=404, detail="Student profile not found")
        if student_id and student.id != student_id:
            raise HTTPException(status_code=403, detail="Forbidden resource")
        return student
    if student_id is None:
        raise HTTPException(status_code=422, detail="Student is required")
    return get_owned_student(db, student_id, user)


def _query():
    return select(MealPlan).options(selectinload(MealPlan.meals).selectinload(MealPlanMeal.items))


def _serialize(plan: MealPlan) -> dict:
    return {
        "id": plan.id, "personal_id": plan.personal_id, "student_id": plan.student_id,
        "name": plan.name, "start_date": plan.start_date, "end_date": plan.end_date,
        "notes": plan.notes, "status": plan.status, "created_at": plan.created_at, "updated_at": plan.updated_at,
        "meals": [{
            "id": meal.id, "name": meal.name, "time": meal.time, "notes": meal.notes, "position": meal.position,
            "items": [{"id": item.id, "food_name": item.food_name, "quantity": item.quantity, "unit": item.unit, "notes": item.notes, "position": item.position} for item in meal.items],
        } for meal in plan.meals],
    }


def list_plans(db: Session, user: User, student_id: uuid.UUID | None = None) -> list[dict]:
    student = _student_for_user(db, user, student_id)
    rows = db.scalars(_query().where(MealPlan.student_id == student.id, MealPlan.personal_id == student.personal_id).order_by(MealPlan.start_date.desc(), MealPlan.created_at.desc())).all()
    return [_serialize(row) for row in rows]


def active_plan(db: Session, user: User, student_id: uuid.UUID | None = None) -> dict | None:
    student = _student_for_user(db, user, student_id)
    plan = db.scalar(_query().where(MealPlan.student_id == student.id, MealPlan.personal_id == student.personal_id, MealPlan.status == MealPlanStatus.ACTIVE))
    return _serialize(plan) if plan else None


def _owned_plan(db: Session, personal: User, plan_id: uuid.UUID) -> MealPlan:
    plan = db.scalar(_query().where(MealPlan.id == plan_id))
    if not plan:
        raise HTTPException(status_code=404, detail="Plano alimentar não encontrado")
    get_owned_student(db, plan.student_id, personal)
    if plan.personal_id != personal.id:
        raise HTTPException(status_code=403, detail="Forbidden resource")
    return plan


def _replace_content(plan: MealPlan, payload: MealPlanWrite) -> None:
    plan.name = payload.name.strip(); plan.start_date = payload.start_date; plan.end_date = payload.end_date
    plan.notes = payload.notes.strip() if payload.notes else None
    plan.meals.clear()
    for meal_position, meal_data in enumerate(payload.meals):
        meal = MealPlanMeal(name=meal_data.name.strip(), time=meal_data.time, notes=meal_data.notes.strip() if meal_data.notes else None, position=meal_position)
        meal.items = [MealPlanItem(food_name=item.food_name.strip(), quantity=item.quantity, unit=item.unit, notes=item.notes.strip() if item.notes else None, position=item_position) for item_position, item in enumerate(meal_data.items)]
        plan.meals.append(meal)


def create_plan(db: Session, personal: User, payload: MealPlanWrite) -> dict:
    student = get_owned_student(db, payload.student_id, personal)
    try:
        db.execute(update(MealPlan).where(MealPlan.student_id == student.id, MealPlan.personal_id == personal.id, MealPlan.status == MealPlanStatus.ACTIVE).values(status=MealPlanStatus.ARCHIVED))
        plan = MealPlan(personal_id=personal.id, student_id=student.id, name=payload.name, start_date=payload.start_date, status=MealPlanStatus.ACTIVE)
        _replace_content(plan, payload); db.add(plan); db.commit()
        return _serialize(db.scalar(_query().where(MealPlan.id == plan.id)))
    except Exception:
        db.rollback(); raise


def update_plan(db: Session, personal: User, plan_id: uuid.UUID, payload: MealPlanWrite) -> dict:
    try:
        plan = _owned_plan(db, personal, plan_id)
        if payload.student_id != plan.student_id:
            raise HTTPException(status_code=422, detail="Student cannot be changed")
        _replace_content(plan, payload); db.commit()
        return _serialize(db.scalar(_query().where(MealPlan.id == plan.id)))
    except Exception:
        db.rollback(); raise


def archive_plan(db: Session, personal: User, plan_id: uuid.UUID) -> dict:
    plan = _owned_plan(db, personal, plan_id); plan.status = MealPlanStatus.ARCHIVED; db.commit()
    return _serialize(db.scalar(_query().where(MealPlan.id == plan.id)))
