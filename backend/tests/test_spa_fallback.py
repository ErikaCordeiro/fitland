from app.main import is_spa_fallback_blocked_path


def test_private_and_dynamic_paths_never_receive_the_spa_shell():
    for path in (
        "private",
        "private/nonexistent.pdf",
        "PRIVATE/nonexistent.pdf",
        r"private\nonexistent.pdf",
        "private/../uploads/branding/logo.png",
        "uploads/private/nonexistent.pdf",
        "api/users/me",
    ):
        assert is_spa_fallback_blocked_path(path) is True


def test_public_assets_and_frontend_routes_keep_their_existing_behavior():
    for path in (
        "assets/index.js",
        "fitland-icon.svg",
        "personal/hugo/login",
        "personal/thiago-fillipo/aluno/login",
    ):
        assert is_spa_fallback_blocked_path(path) is False
