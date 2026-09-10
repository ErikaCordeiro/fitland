import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, JSON, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class PersonalBranding(Base):
    __tablename__ = "personal_brandings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    personal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True, nullable=False
    )
    display_name: Mapped[str] = mapped_column(String(160), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    logo_url: Mapped[str | None] = mapped_column(String(500))
    profile_image_url: Mapped[str | None] = mapped_column(String(500))
    primary_color: Mapped[str] = mapped_column(String(7), default="#050505", nullable=False)
    secondary_color: Mapped[str] = mapped_column(String(7), default="#C0C0C0", nullable=False)
    icon_url: Mapped[str | None] = mapped_column(String(500))
    login_subtitle: Mapped[str | None] = mapped_column(String(180))
    banner_url: Mapped[str | None] = mapped_column(String(500))
    background_color: Mapped[str] = mapped_column(String(7), default="#050505", nullable=False)
    surface_color: Mapped[str] = mapped_column(String(7), default="#121416", nullable=False)
    accent_color: Mapped[str] = mapped_column(String(7), default="#C0C0C0", nullable=False)
    border_color: Mapped[str] = mapped_column(String(7), default="#34373A", nullable=False)
    text_color: Mapped[str] = mapped_column(String(7), default="#F5F5F5", nullable=False)
    muted_text_color: Mapped[str] = mapped_column(String(7), default="#A7ABB0", nullable=False)
    font_family: Mapped[str] = mapped_column(String(32), default="Inter", nullable=False)
    modules: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    personal = relationship("User", back_populates="branding")
