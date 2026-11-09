import logging
import smtplib

import pytest

from app.core.config import settings
from app.services import email_service


class FakeSMTP:
    error = None
    refused = {}
    instance = None

    def __init__(self, host, port, timeout):
        self.host = host
        self.port = port
        self.timeout = timeout
        self.calls = []
        self.message = None
        type(self).instance = self
        if isinstance(self.error, OSError):
            raise self.error

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def ehlo(self):
        self.calls.append("ehlo")
        return 250, b"ok"

    def starttls(self, context):
        self.calls.append("starttls")
        return 220, b"ready"

    def login(self, username, password):
        self.calls.append("login")
        if isinstance(self.error, smtplib.SMTPAuthenticationError):
            raise self.error
        return 235, b"ok"

    def send_message(self, message):
        self.calls.append("send_message")
        self.message = message
        if isinstance(self.error, smtplib.SMTPDataError):
            raise self.error
        return self.refused


@pytest.fixture(autouse=True)
def smtp_settings(monkeypatch):
    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.example.test")
    monkeypatch.setattr(settings, "SMTP_PORT", 587)
    monkeypatch.setattr(settings, "SMTP_USERNAME", "mailer@example.test")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "synthetic-app-password")
    monkeypatch.setattr(settings, "SMTP_FROM_EMAIL", "mailer@example.test")
    monkeypatch.setattr(settings, "SMTP_USE_TLS", True)
    FakeSMTP.error = None
    FakeSMTP.refused = {}
    FakeSMTP.instance = None
    monkeypatch.setattr(email_service.smtplib, "SMTP", FakeSMTP)


def test_success_records_post_data_acceptance_and_builds_traceable_message(caplog):
    caplog.set_level(logging.INFO)

    result = email_service.send_student_access_invite_email(
        "student@example.test",
        "https://fitland.test/personal/demo/aluno/primeiro-acesso?token=synthetic",
        "Personal Demo",
    )

    smtp = FakeSMTP.instance
    assert result == "accepted_by_smtp"
    assert smtp.calls == ["ehlo", "starttls", "ehlo", "login", "send_message"]
    assert smtp.message["From"] == "mailer@example.test"
    assert smtp.message["To"] == "student@example.test"
    assert smtp.message["Date"]
    assert smtp.message["Message-ID"].endswith("@example.test>")
    assert len(smtp.message["X-Fitland-Correlation-ID"]) == 32
    assert "result=accepted_after_data" in caplog.text
    assert "student@example.test" not in caplog.text
    assert "synthetic" not in caplog.text


def test_password_reset_uses_same_verified_delivery_path():
    assert email_service.send_password_reset_email(
        "owner@example.test",
        "https://fitland.test/reset?token=synthetic",
    ) == "accepted_by_smtp"
    assert FakeSMTP.instance.calls[-1] == "send_message"


def test_authentication_failure_is_raised_and_sanitized(caplog):
    FakeSMTP.error = smtplib.SMTPAuthenticationError(535, b"bad credentials")

    with pytest.raises(smtplib.SMTPAuthenticationError):
        email_service.send_password_reset_email("owner@example.test", "https://fitland.test/reset")

    assert "result=authentication_failed" in caplog.text
    assert "bad credentials" not in caplog.text


def test_recipient_refusal_is_raised_and_counted(caplog):
    FakeSMTP.refused = {"student@example.test": (550, b"refused")}

    with pytest.raises(smtplib.SMTPRecipientsRefused):
        email_service.send_student_access_invite_email(
            "student@example.test", "https://fitland.test/invite", "Personal Demo"
        )

    assert "result=recipients_refused rejected_count=1" in caplog.text
    assert "student@example.test" not in caplog.text


def test_failure_after_data_is_raised_with_status_only(caplog):
    FakeSMTP.error = smtplib.SMTPDataError(554, b"provider detail")

    with pytest.raises(smtplib.SMTPDataError):
        email_service.send_password_reset_email("owner@example.test", "https://fitland.test/reset")

    assert "result=data_rejected smtp_code=554" in caplog.text
    assert "provider detail" not in caplog.text


def test_connection_failure_is_raised_without_sensitive_context(caplog):
    FakeSMTP.error = OSError("network detail")

    with pytest.raises(OSError):
        email_service.send_password_reset_email("owner@example.test", "https://fitland.test/reset")

    assert "result=transport_failed error_type=OSError" in caplog.text
    assert "network detail" not in caplog.text
