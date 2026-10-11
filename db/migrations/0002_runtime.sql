ALTER TABLE users ADD COLUMN consent_at TIMESTAMPTZ;
CREATE TABLE refresh_sessions (id UUID PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id), token_hash TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL);
CREATE TABLE phone_challenges (user_id BIGINT PRIMARY KEY REFERENCES users(id), code_hash TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL, attempts INTEGER NOT NULL DEFAULT 0);
ALTER TABLE payments ADD COLUMN coins INTEGER CHECK (coins > 0);
ALTER TABLE payments ADD COLUMN idempotency_key TEXT UNIQUE;
ALTER TABLE payments ADD COLUMN checkout_url TEXT;
CREATE TABLE idempotent_results (key TEXT PRIMARY KEY, actor_id BIGINT NOT NULL REFERENCES users(id), operation TEXT NOT NULL, resource_id BIGINT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
ALTER TABLE requests ADD CONSTRAINT requests_count_positive CHECK (unlocked_count >= 0);
