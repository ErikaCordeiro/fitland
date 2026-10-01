import uuid

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import require_module, require_personal, require_student_or_personal
from app.db.session import get_db
from app.models.user import User
from app.schemas.assessment import AssessmentCreate, AssessmentDetail, AssessmentRead, AssessmentUpdate
from app.services.assessment_service import assessment_detail, create_assessment, delete_assessment, list_assessments, update_assessment


router = APIRouter(dependencies=[Depends(require_module("assessments"))])


@router.get("", response_model=list[AssessmentRead])
def index(student_id: uuid.UUID | None = Query(default=None), db: Session = Depends(get_db), user: User = Depends(require_student_or_personal)):
    return list_assessments(db, user, student_id)


@router.get("/{assessment_id}", response_model=AssessmentDetail)
def show(assessment_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(require_student_or_personal)):
    return assessment_detail(db, user, assessment_id)


@router.post("", response_model=AssessmentRead, status_code=status.HTTP_201_CREATED)
def create(payload: AssessmentCreate, db: Session = Depends(get_db), personal: User = Depends(require_personal)):
    return create_assessment(db, personal, payload)


@router.patch("/{assessment_id}", response_model=AssessmentRead)
def update(assessment_id: uuid.UUID, payload: AssessmentUpdate, db: Session = Depends(get_db), personal: User = Depends(require_personal)):
    return update_assessment(db, personal, assessment_id, payload)


@router.delete("/{assessment_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove(assessment_id: uuid.UUID, db: Session = Depends(get_db), personal: User = Depends(require_personal)):
    delete_assessment(db, personal, assessment_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
