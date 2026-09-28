from app.db import seed as seed_module
from app.services import owner_service


def test_production_seed_never_mutates_personal_or_student_data(monkeypatch):
    events = []

    class FakeSession:
        def close(self):
            events.append("closed")

        def __getattr__(self, name):
            raise AssertionError(f"production tenant seed attempted database operation: {name}")

    monkeypatch.setattr(seed_module, "init_db", lambda: events.append("initialized"))
    monkeypatch.setattr(seed_module, "SessionLocal", FakeSession)
    monkeypatch.setattr(seed_module.settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(owner_service, "ensure_owner", lambda db: events.append("owner_checked"))

    seed_module.seed()

    assert events == ["initialized", "owner_checked", "closed"]
