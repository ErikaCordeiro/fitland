import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_module, require_personal
from app.db.session import get_db
from app.models.user import User
from app.schemas.video import VideoCreate, VideoRead, VideoUpsert
from app.services.video_service import create_video, upsert_exercise_video

router = APIRouter(dependencies=[Depends(require_module("workouts"))])


@router.post("", response_model=VideoRead, status_code=201)
def create(payload: VideoCreate, db: Session = Depends(get_db), personal: User = Depends(require_personal)):
    return create_video(db, personal, payload)


@router.put("/exercise/{exercise_id}", response_model=VideoRead)
def upsert(exercise_id: uuid.UUID, payload: VideoUpsert, db: Session = Depends(get_db), personal: User = Depends(require_personal)):
    return upsert_exercise_video(db, personal, exercise_id, payload)
