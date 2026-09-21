import smtplib
import ssl
from email.message import EmailMessage

from app.core.config import settings


def send_password_reset_email(recipient: str, reset_url: str) -> None:
    if not settings.SMTP_HOST or not settings.SMTP_FROM_EMAIL:
        raise RuntimeError("Password reset email is not configured")

    message = EmailMessage()
    message["Subject"] = "Redefinicao de senha - Fitland"
    message["From"] = settings.SMTP_FROM_EMAIL
    message["To"] = recipient
    message.set_content(
        "Recebemos uma solicitacao para redefinir sua senha.\n\n"
        f"Acesse o link abaixo em ate {settings.PASSWORD_RESET_EXPIRE_MINUTES} minutos:\n"
        f"{reset_url}\n\n"
        "Se voce nao solicitou esta alteracao, ignore esta mensagem."
    )

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as smtp:
        if settings.SMTP_USE_TLS:
            smtp.starttls(context=ssl.create_default_context())
        if settings.SMTP_USERNAME:
            smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD or "")
        smtp.send_message(message)
