from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import require_module, require_student
from app.db.session import get_db
from app.models.audit_log import AuditLog
from app.models.personal_branding import PersonalBranding
from app.models.student import Student
from app.models.user import User
from app.schemas.coach import CoachEscalationRequest, CoachEscalationResponse, CoachMessageRequest, CoachMessageResponse
from app.services.coach import CoachService
from app.services.coach.escalation import send_escalation
from app.services.module_registry import resolve_modules
from sqlalchemy import select


router = APIRouter(dependencies=[Depends(require_module("coach"))])


@router.post("/messages", response_model=CoachMessageResponse)
def coach_message(payload: CoachMessageRequest, db: Session = Depends(get_db), student: User = Depends(require_student)):
    return CoachService(db, student).respond(payload)


@router.post("/escalations", response_model=CoachEscalationResponse)
def coach_escalation(payload: CoachEscalationRequest, db: Session = Depends(get_db), student: User = Depends(require_student)):
    profile = db.scalar(select(Student).where(Student.user_id == student.id))
    branding = db.scalar(select(PersonalBranding).where(PersonalBranding.personal_id == profile.personal_id)) if profile else None
    if not profile or resolve_modules((branding.modules if branding else None) or {}).get("messages") is not True:
        raise HTTPException(status_code=403, detail={"code": "module_disabled", "module": "messages"})
    try:
        row = send_escalation(db, student, payload.token)
    except ValueError:
        raise HTTPException(status_code=422, detail="Encaminhamento inválido ou expirado")
    db.add(AuditLog(actor_user_id=student.id, action="coach_escalation_sent", entity_type="coach", entity_id=str(row.id), details={"personal_id": str(profile.personal_id), "student_id": str(profile.id)}))
    db.commit()
    return {"sent": True, "message": "Mensagem encaminhada ao seu Personal."}
