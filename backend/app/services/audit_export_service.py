import csv
import io
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.user import User


CSV_HEADERS = ("data_hora", "usuario", "acao", "entidade", "entidade_id", "resultado", "request_id")


def audit_log_query(action: str | None = None, result: str | None = None):
    query = select(AuditLog, User.name).outerjoin(User, User.id == AuditLog.actor_user_id)
    if action:
        query = query.where(AuditLog.action == action)
    if result:
        query = query.where(AuditLog.result == result)
    return query


def _safe_csv_value(value) -> str:
    text = "" if value is None else str(value)
    if text.startswith(("=", "+", "-", "@")):
        return f"'{text}"
    return text


def export_audit_logs_csv(db: Session, action: str | None = None, result: str | None = None) -> tuple[str, bytes]:
    rows = db.execute(audit_log_query(action, result).order_by(AuditLog.created_at.desc())).all()
    output = io.StringIO(newline="")
    writer = csv.writer(output, delimiter=";", lineterminator="\r\n")
    writer.writerow(CSV_HEADERS)
    for log, actor_name in rows:
        # Export only the administrative fields shown by this area. Arbitrary
        # details, headers and user agents stay server-side to prevent secrets
        # or credentials from entering the file.
        request_id = (log.details or {}).get("request_id", "")
        writer.writerow(_safe_csv_value(value) for value in (
            log.created_at.isoformat(),
            actor_name or "Sistema",
            log.action,
            log.entity_type,
            log.entity_id,
            log.result,
            request_id,
        ))
    filename = f"fitland-logs-{date.today().isoformat()}.csv"
    return filename, ("\ufeff" + output.getvalue()).encode("utf-8")
