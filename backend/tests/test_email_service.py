import logging
import smtplib
from urllib import error

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
    monkeypatch.setattr(settings, "EMAIL_PROVIDER", "smtp")
    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.example.test")
    monkeypatch.setattr(settings, "SMTP_PORT", 587)
    monkeypatch.setattr(settings, "SMTP_USERNAME", "mailer@example.test")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "synthetic-app-password")
    monkeypatch.setattr(settings, "SMTP_FROM_EMAIL", "mailer@example.test")
    monkeypatch.setattr(settings, "SMTP_USE_TLS", True)
    monkeypatch.setattr(settings, "GMAIL_CLIENT_ID", None)
    monkeypatch.setattr(settings, "GMAIL_CLIENT_SECRET", None)
    monkeypatch.setattr(settings, "GMAIL_REFRESH_TOKEN", None)
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


class FakeHTTPResponse:
    def __init__(self, payload):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def read(self):
        return self.payload


def test_gmail_api_sends_over_https_and_logs_provider_acceptance(monkeypatch, caplog):
    caplog.set_level(logging.INFO)
    monkeypatch.setattr(settings, "EMAIL_PROVIDER", "gmail_api")
    monkeypatch.setattr(settings, "GMAIL_CLIENT_ID", "synthetic-client")
    monkeypatch.setattr(settings, "GMAIL_CLIENT_SECRET", "synthetic-secret")
    monkeypatch.setattr(settings, "GMAIL_REFRESH_TOKEN", "synthetic-refresh")
    responses = iter(
        [
            FakeHTTPResponse(b'{"access_token":"synthetic-access"}'),
            FakeHTTPResponse(b'{"id":"provider-message-id"}'),
        ]
    )
    requests = []

    def fake_urlopen(http_request, timeout):
        requests.append(http_request)
        assert timeout == 15
        return next(responses)

    monkeypatch.setattr(email_service.request, "urlopen", fake_urlopen)

    result = email_service.send_password_reset_email(
        "owner@example.test", "https://fitland.test/reset?token=synthetic"
    )

    assert result == "accepted_by_provider"
    assert requests[0].full_url == "https://oauth2.googleapis.com/token"
    assert requests[1].full_url == "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"
    assert requests[1].get_header("Authorization") == "Bearer synthetic-access"
    assert "result=accepted_by_provider" in caplog.text
    assert "provider_message_id_present=True" in caplog.text
    assert "owner@example.test" not in caplog.text
    assert "synthetic-access" not in caplog.text
    assert "synthetic-refresh" not in caplog.text


def test_gmail_api_http_failure_is_sanitized(monkeypatch, caplog):
    monkeypatch.setattr(settings, "EMAIL_PROVIDER", "gmail_api")
    monkeypatch.setattr(settings, "GMAIL_CLIENT_ID", "synthetic-client")
    monkeypatch.setattr(settings, "GMAIL_CLIENT_SECRET", "synthetic-secret")
    monkeypatch.setattr(settings, "GMAIL_REFRESH_TOKEN", "synthetic-refresh")

    def fail_urlopen(*_args, **_kwargs):
        raise error.HTTPError("https://oauth2.googleapis.com/token", 401, "private detail", {}, None)

    monkeypatch.setattr(email_service.request, "urlopen", fail_urlopen)

    with pytest.raises(error.HTTPError):
        email_service.send_password_reset_email("owner@example.test", "https://fitland.test/reset")

    assert "provider=gmail_api result=http_failed status=401" in caplog.text
    assert "owner@example.test" not in caplog.text
    assert "private detail" not in caplog.text


def test_gmail_api_requires_all_oauth_credentials(monkeypatch):
    monkeypatch.setattr(settings, "EMAIL_PROVIDER", "gmail_api")

    with pytest.raises(RuntimeError, match="Gmail API email provider is not configured"):
        email_service.send_password_reset_email("owner@example.test", "https://fitland.test/reset")
