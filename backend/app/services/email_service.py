import logging
import smtplib
import ssl
import uuid
from datetime import datetime, timezone
from email.message import EmailMessage
from email.utils import format_datetime, make_msgid

from app.core.config import settings

logger = logging.getLogger(__name__)


def _message_id_domain() -> str | None:
    sender = settings.SMTP_FROM_EMAIL or ""
    return sender.rsplit("@", 1)[1] if "@" in sender else None


def _build_message(subject: str, recipient: str, content: str) -> tuple[EmailMessage, str]:
    correlation_id = uuid.uuid4().hex
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.SMTP_FROM_EMAIL
    message["To"] = recipient
    message["Date"] = format_datetime(datetime.now(timezone.utc))
    message["Message-ID"] = make_msgid(domain=_message_id_domain())
    message["X-Fitland-Correlation-ID"] = correlation_id
    message.set_content(content)
    return message, correlation_id


def _send_message(message: EmailMessage, correlation_id: str) -> str:
    logger.info(
        "[smtp] decision correlation_id=%s result=attempt tls=%s auth=%s",
        correlation_id,
        settings.SMTP_USE_TLS,
        bool(settings.SMTP_USERNAME),
    )
    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as smtp:
            smtp.ehlo()
            if settings.SMTP_USE_TLS:
                smtp.starttls(context=ssl.create_default_context())
                smtp.ehlo()
            if settings.SMTP_USERNAME:
                smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD or "")
            refused = smtp.send_message(message)
            if refused:
                raise smtplib.SMTPRecipientsRefused(refused)
    except smtplib.SMTPAuthenticationError:
        logger.warning("[smtp] decision correlation_id=%s result=authentication_failed", correlation_id)
        raise
    except smtplib.SMTPRecipientsRefused as exc:
        logger.warning(
            "[smtp] decision correlation_id=%s result=recipients_refused rejected_count=%s",
            correlation_id,
            len(exc.recipients),
        )
        raise
    except smtplib.SMTPDataError as exc:
        logger.warning(
            "[smtp] decision correlation_id=%s result=data_rejected smtp_code=%s",
            correlation_id,
            exc.smtp_code,
        )
        raise
    except (OSError, smtplib.SMTPException) as exc:
        logger.warning(
            "[smtp] decision correlation_id=%s result=transport_failed error_type=%s",
            correlation_id,
            type(exc).__name__,
        )
        raise

    logger.info("[smtp] decision correlation_id=%s result=accepted_after_data", correlation_id)
    return "accepted_by_smtp"


def send_password_reset_email(recipient: str, reset_url: str) -> str:
    if not settings.SMTP_HOST or not settings.SMTP_FROM_EMAIL:
        raise RuntimeError("Password reset email is not configured")

    message, correlation_id = _build_message(
        "Redefinicao de senha - Fitland",
        recipient,
        "Recebemos uma solicitacao para redefinir sua senha.\n\n"
        f"Acesse o link abaixo em ate {settings.PASSWORD_RESET_EXPIRE_MINUTES} minutos:\n"
        f"{reset_url}\n\n"
        "Se voce nao solicitou esta alteracao, ignore esta mensagem.",
    )
    return _send_message(message, correlation_id)


def send_student_access_invite_email(recipient: str, invite_url: str, personal_name: str) -> str:
    if not settings.SMTP_HOST or not settings.SMTP_FROM_EMAIL:
        raise RuntimeError("Email provider is not configured")
    message, correlation_id = _build_message(
        f"Seu acesso ao Fitland com {personal_name}",
        recipient,
        "Você recebeu um convite para criar seu acesso. "
        f"O link é válido por 24 horas: {invite_url}\n\n"
        "Se você não esperava este convite, ignore esta mensagem.",
    )
    return _send_message(message, correlation_id)
