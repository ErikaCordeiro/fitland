CREATE TABLE IF NOT EXISTS refresh_token_sessions (
    id UUID PRIMARY KEY,
    jti_hash VARCHAR(64) NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    context VARCHAR(16) NOT NULL,
    persistent BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ NULL,
    revoked_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_refresh_token_sessions_jti_hash ON refresh_token_sessions(jti_hash);
CREATE INDEX IF NOT EXISTS ix_refresh_token_sessions_user_id ON refresh_token_sessions(user_id);
CREATE INDEX IF NOT EXISTS ix_refresh_token_sessions_expires_at ON refresh_token_sessions(expires_at);

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
    bucket_hash VARCHAR(64) PRIMARY KEY,
    scope VARCHAR(48) NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    expires_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_rate_limit_buckets_scope ON rate_limit_buckets(scope);
CREATE INDEX IF NOT EXISTS ix_rate_limit_buckets_expires_at ON rate_limit_buckets(expires_at);
