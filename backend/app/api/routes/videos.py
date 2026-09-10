from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_module, require_personal
from app.db.session import get_db
from app.models.user import User
from app.schemas.video import VideoCreate, VideoRead
from app.services.video_service import create_video

router = APIRouter(dependencies=[Depends(require_module("workouts"))])


@router.post("", response_model=VideoRead, status_code=201)
def create(payload: VideoCreate, db: Session = Depends(get_db), personal: User = Depends(require_personal)):
    return create_video(db, personal, payload)
