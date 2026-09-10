import secrets
import uuid
from datetime import datetime

from sqlalchemy import asc, desc, func, or_, select
from sqlalchemy.orm import Session
from starlette import status

from app.core.errors import DomainError
from app.core.owner_bootstrap import normalize_owner_email, normalize_owner_password
from app.core.security import hash_password, verify_password
from app.models.audit_log import AuditLog
from app.models.student import Student
from app.models.personal_branding import PersonalBranding
from app.models.user import User, UserRole
from app.models.workout import Workout
from app.schemas.owner import OwnerPersonalCreate, OwnerPersonalUpdate
from app.schemas.branding import BrandingUpdate
from app.services.branding_service import brand_slug


def audit(db: Session, actor: User | None, action: str, entity_type: str, entity_id=None, details=None, result="success"):
    db.add(AuditLog(actor_user_id=actor.id if actor else None, action=action, entity_type=entity_type,
                    entity_id=str(entity_id) if entity_id else None, details=details or {}, result=result))


def ensure_owner(db: Session) -> User | None:
    from app.core.config import settings
    name = (settings.OWNER_INITIAL_NAME or "").strip()
    email = normalize_owner_email(settings.OWNER_INITIAL_EMAIL)
    password = normalize_owner_password(settings.OWNER_INITIAL_PASSWORD)
    if not name or not email or not password:
        return None
    matches = db.scalars(select(User).where(func.lower(func.trim(User.email)) == email)).all()
    print(
        "[owner] account_check "
        f"user_found={str(bool(matches)).lower()} user_count={len(matches)} "
        f"force_reset={str(settings.OWNER_FORCE_PASSWORD_RESET).lower()}"
    )
    if len(matches) > 1:
        raise RuntimeError("Multiple owner candidates found after email normalization")
    existing = matches[0] if matches else None
    if existing:
        if existing.role != UserRole.OWNER:
            raise RuntimeError("OWNER_INITIAL_EMAIL already belongs to another profile")
        existing.name = name
        existing.email = email
        if settings.OWNER_FORCE_PASSWORD_RESET:
            existing.hashed_password = hash_password(password)
            existing.is_active = True
            existing.account_status = "active"
            existing.deleted_at = None
            existing.must_change_password = True
            audit(db, existing, "owner_password_reset", "user", existing.id, {"source": "environment_reset"})
            db.commit()
            db.refresh(existing)
            password_verified = verify_password(password, existing.hashed_password)
            print(
                "[owner] temporary password reset applied; "
                f"persisted_hash_valid={password_verified}; "
                "disable OWNER_FORCE_PASSWORD_RESET after login"
            )
            if not password_verified:
                raise RuntimeError("Owner password reset was not persisted correctly")
        else:
            print(
                "[owner] existing account preserved "
                f"active={str(existing.is_active).lower()} status={existing.account_status} "
                f"hash_present={str(bool(existing.hashed_password)).lower()} "
                f"must_change_password={str(existing.must_change_password).lower()}"
            )
        return existing
    owner = User(name=name, email=email, hashed_password=hash_password(password), role=UserRole.OWNER,
                 is_active=True, account_status="active", must_change_password=True)
    db.add(owner)
    db.flush()
    audit(db, owner, "owner_created", "user", owner.id, {"source": "environment_seed"})
    db.commit()
    db.refresh(owner)
    if not verify_password(password, owner.hashed_password):
        raise RuntimeError("Owner creation produced an unverifiable password hash")
    print("[owner] account_created persisted_hash_valid=true")
    return owner


def dashboard_summary(db: Session) -> dict:
    personals = select(User).where(User.role == UserRole.PERSONAL, User.deleted_at.is_(None)).subquery()
    counts = dict(db.execute(select(personals.c.account_status, func.count()).group_by(personals.c.account_status)).all())
    return {
        "personals_active": counts.get("active", 0),
        "personals_suspended": counts.get("suspended", 0),
        "personals_blocked": counts.get("blocked", 0),
        "students_total": db.scalar(select(func.count(Student.id))) or 0,
        "alerts": [],
    }


def list_personals(db: Session, search="", account_status=None, sort="name", order="asc", page=1, size=10):
    student_counts = select(Student.personal_id, func.count(Student.id).label("student_count")).group_by(Student.personal_id).subquery()
    workout_counts = select(Workout.personal_id, func.count(Workout.id).label("workout_count")).group_by(Workout.personal_id).subquery()
    query = (select(User, func.coalesce(student_counts.c.student_count, 0), func.coalesce(workout_counts.c.workout_count, 0))
             .outerjoin(student_counts, student_counts.c.personal_id == User.id)
             .outerjoin(workout_counts, workout_counts.c.personal_id == User.id)
             .where(User.role == UserRole.PERSONAL, User.deleted_at.is_(None)))
    if search:
        term = f"%{search.strip().lower()}%"
        query = query.where(or_(func.lower(User.name).like(term), func.lower(User.email).like(term)))
    if account_status:
        query = query.where(User.account_status == account_status)
    sort_column = {"name": User.name, "created_at": User.created_at, "last_login_at": User.last_login_at}.get(sort, User.name)
    query = query.order_by((desc if order == "desc" else asc)(sort_column))
    total = db.scalar(select(func.count()).select_from(query.order_by(None).subquery())) or 0
    rows = db.execute(query.offset((page - 1) * size).limit(size)).all()
    return total, [personal_to_dict(user, students, workouts) for user, students, workouts in rows]


def personal_to_dict(user: User, student_count=0, workout_count=0):
    branding = getattr(user, "branding", None)
    return {"id": user.id, "name": user.name, "email": user.email, "phone": user.phone,
            "avatar_url": user.avatar_url, "status": user.account_status, "student_count": student_count,
            "workout_count": workout_count, "created_at": user.created_at, "last_login_at": user.last_login_at,
            "profile": "PERSONAL_ADMIN", "brand_name": branding.display_name if branding else f"Personal {user.name}"}


def get_personal(db: Session, personal_id: uuid.UUID):
    user = db.scalar(select(User).where(User.id == personal_id, User.role == UserRole.PERSONAL, User.deleted_at.is_(None)))
    if not user:
        raise DomainError("Personal not found", status.HTTP_404_NOT_FOUND)
    students = db.scalar(select(func.count(Student.id)).where(Student.personal_id == user.id)) or 0
    workouts = db.scalar(select(func.count(Workout.id)).where(Workout.personal_id == user.id)) or 0
    return user, students, workouts


def create_personal(db: Session, actor: User, payload: OwnerPersonalCreate):
    email = payload.email.lower()
    if db.scalar(select(User).where(func.lower(User.email) == email)):
        raise DomainError("Email already registered", status.HTTP_409_CONFLICT)
    user = User(name=payload.name.strip(), email=email, phone=payload.phone, hashed_password=hash_password(payload.password),
                role=UserRole.PERSONAL, account_status=payload.status, is_active=payload.status == "active", must_change_password=True)
    db.add(user)
    db.flush()
    branding = payload.branding or BrandingUpdate(display_name=f"Personal {user.name}", slug=brand_slug(user.name))
    db.add(PersonalBranding(personal_id=user.id, **branding.model_dump()))
    audit(db, actor, "personal_created", "user", user.id, {"status": payload.status})
    db.commit()
    db.refresh(user)
    return user


def update_personal(db: Session, actor: User, user: User, payload: OwnerPersonalUpdate):
    changes = payload.model_dump(exclude_unset=True)
    if "email" in changes:
        changes["email"] = str(changes["email"]).lower()
        duplicate = db.scalar(select(User).where(func.lower(User.email) == changes["email"], User.id != user.id))
        if duplicate: raise DomainError("Email already registered", status.HTTP_409_CONFLICT)
    for key, value in changes.items(): setattr(user, key, value)
    audit(db, actor, "personal_updated", "user", user.id, {"fields": sorted(changes)}); db.commit(); db.refresh(user); return user


def change_status(db: Session, actor: User, user: User, value: str, reason=None):
    user.account_status = value; user.is_active = value == "active"
    audit(db, actor, f"personal_{value}", "user", user.id, {"reason": reason} if reason else {})
    db.commit(); db.refresh(user); return user


def reset_access(db: Session, actor: User, user: User):
    temporary = secrets.token_urlsafe(12)
    user.hashed_password = hash_password(temporary); user.must_change_password = True
    audit(db, actor, "personal_access_reset", "user", user.id)
    db.commit()
    return temporary


def soft_delete(db: Session, actor: User, user: User):
    user.deleted_at = datetime.utcnow(); user.account_status = "deleted"; user.is_active = False
    audit(db, actor, "personal_deleted", "user", user.id); db.commit()


def change_owner_password(db: Session, owner: User, current: str, new: str):
    if not verify_password(current, owner.hashed_password):
        raise DomainError("Current password is invalid", status.HTTP_400_BAD_REQUEST)
    owner.hashed_password = hash_password(new); owner.must_change_password = False
    audit(db, owner, "owner_password_changed", "user", owner.id); db.commit()
