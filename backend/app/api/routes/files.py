import re
import uuid
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, Response, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import require_module, require_personal, require_student_or_personal
from app.db.session import get_db
from app.models.user import User
from app.schemas.student_file import StudentFileRead, StudentFileUpdate
from app.services.private_file_storage import resolve_storage_key
from app.services.student_file_service import create_student_file, delete_student_file, get_accessible_file, list_student_files, update_student_file


router = APIRouter(dependencies=[Depends(require_module("files"))])


@router.get("", response_model=list[StudentFileRead])
def list_files(student_id: uuid.UUID | None = None, db: Session = Depends(get_db), user: User = Depends(require_student_or_personal)):
    return list_student_files(db, user, student_id)


@router.post("", response_model=StudentFileRead, status_code=status.HTTP_201_CREATED)
async def upload_file(
    student_id: uuid.UUID = Form(...),
    file: UploadFile = File(...),
    title: str | None = Form(default=None, max_length=180),
    description: str | None = Form(default=None, max_length=2000),
    category: str = Form(default="other"),
    visible_to_student: bool = Form(default=False),
    db: Session = Depends(get_db),
    personal: User = Depends(require_personal),
):
    return await create_student_file(db, personal, student_id, file, title, description, category, visible_to_student)


@router.patch("/{file_id}", response_model=StudentFileRead)
def update_file(file_id: uuid.UUID, payload: StudentFileUpdate, db: Session = Depends(get_db), personal: User = Depends(require_personal)):
    return update_student_file(db, personal, file_id, payload)


@router.get("/{file_id}/download")
def download_file(file_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(require_student_or_personal)):
    row = get_accessible_file(db, user, file_id)
    path = resolve_storage_key(row.storage_key)
    if not path.is_file():
        return Response(status_code=404, content="Arquivo indisponível")
    fallback = re.sub(r"[^A-Za-z0-9._-]", "_", row.original_filename) or "arquivo"
    disposition = f"attachment; filename=\"{fallback}\"; filename*=UTF-8''{quote(row.original_filename, safe='')}"
    return FileResponse(path, media_type=row.mime_type, headers={
        "Content-Disposition": disposition,
        "Cache-Control": "private, no-store",
        "Pragma": "no-cache",
        "X-Content-Type-Options": "nosniff",
    })


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_file(file_id: uuid.UUID, db: Session = Depends(get_db), personal: User = Depends(require_personal)):
    delete_student_file(db, personal, file_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
