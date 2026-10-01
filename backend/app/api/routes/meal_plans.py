import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import require_module, require_personal, require_student_or_personal
from app.db.session import get_db
from app.models.user import User
from app.schemas.meal_plan import MealPlanRead, MealPlanWrite
from app.services.meal_plan_service import active_plan, archive_plan, create_plan, list_plans, update_plan


router = APIRouter(dependencies=[Depends(require_module("diet"))])


@router.get("", response_model=list[MealPlanRead])
def index(student_id: uuid.UUID | None = Query(default=None), db: Session = Depends(get_db), user: User = Depends(require_student_or_personal)):
    return list_plans(db, user, student_id)


@router.get("/active", response_model=MealPlanRead | None)
def current(student_id: uuid.UUID | None = Query(default=None), db: Session = Depends(get_db), user: User = Depends(require_student_or_personal)):
    return active_plan(db, user, student_id)


@router.post("", response_model=MealPlanRead, status_code=status.HTTP_201_CREATED)
def create(payload: MealPlanWrite, db: Session = Depends(get_db), personal: User = Depends(require_personal)):
    return create_plan(db, personal, payload)


@router.put("/{plan_id}", response_model=MealPlanRead)
def replace(plan_id: uuid.UUID, payload: MealPlanWrite, db: Session = Depends(get_db), personal: User = Depends(require_personal)):
    return update_plan(db, personal, plan_id, payload)


@router.post("/{plan_id}/archive", response_model=MealPlanRead)
def archive(plan_id: uuid.UUID, db: Session = Depends(get_db), personal: User = Depends(require_personal)):
    return archive_plan(db, personal, plan_id)
