import uuid
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session
from app.api.deps import require_module, require_personal
from app.db.session import get_db
from app.models.user import User
from app.schemas.reports import ReportsOverview
from app.services.reports_service import export_csv, overview

router = APIRouter(dependencies=[Depends(require_module("reports"))])

@router.get("/overview", response_model=ReportsOverview)
def reports_overview(days: int = Query(30), student_id: uuid.UUID | None = None, db: Session = Depends(get_db), personal: User = Depends(require_personal)):
    return overview(db, personal, days, student_id)

@router.get("/export.csv")
def reports_export(days: int = Query(30), student_id: uuid.UUID | None = None, db: Session = Depends(get_db), personal: User = Depends(require_personal)):
    return Response(content=export_csv(overview(db, personal, days, student_id)), media_type="text/csv; charset=utf-8", headers={"Content-Disposition": "attachment; filename=relatorio-fitland.csv", "Cache-Control": "no-store"})
