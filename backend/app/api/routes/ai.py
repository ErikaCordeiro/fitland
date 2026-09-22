from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.ai import AIStatusResponse
from app.services.ai.service import AIService


router = APIRouter()


@router.get("/status", response_model=AIStatusResponse)
def status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return AIService(db).status()
