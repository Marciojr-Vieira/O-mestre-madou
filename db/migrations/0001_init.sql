-- 0001_init.sql — baseline schema (PostgreSQL 15+)
-- Source of truth for the database. Do not edit after merge: add 0002_*.sql instead.

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ───────── Enums ─────────
CREATE TYPE user_role           AS ENUM ('client', 'pro', 'admin');
CREATE TYPE user_status         AS ENUM ('active', 'suspended', 'deleted');
CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'rejected');
CREATE TYPE question_type       AS ENUM ('text', 'select', 'multi', 'number', 'date', 'file');
CREATE TYPE request_status      AS ENUM ('open', 'closed', 'expired', 'cancelled');
CREATE TYPE request_urgency     AS ENUM ('flexible', 'this_week', 'urgent');
CREATE TYPE lead_status         AS ENUM ('offered', 'viewed', 'unlocked', 'ignored', 'won', 'lost', 'refunded');
CREATE TYPE coin_tx_type        AS ENUM ('purchase', 'unlock', 'refund', 'bonus', 'adjust');
CREATE TYPE payment_method      AS ENUM ('pix', 'card');
CREATE TYPE payment_status      AS ENUM ('pending', 'paid', 'failed', 'expired', 'refunded');
CREATE TYPE review_status       AS ENUM ('pending', 'published', 'removed');
CREATE TYPE refund_status       AS ENUM ('pending', 'approved', 'rejected');

-- ───────── Users ─────────
CREATE TABLE users (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  role               user_role   NOT NULL,
  name               TEXT        NOT NULL,
  email              CITEXT      NOT NULL UNIQUE,
  phone              TEXT        NOT NULL UNIQUE,         -- E.164, e.g. +5562999999999
  password_hash      TEXT        NOT NULL,
  phone_verified_at  TIMESTAMPTZ,
  status             user_status NOT NULL DEFAULT 'active',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE professionals (
  user_id              BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  document_type        TEXT NOT NULL CHECK (document_type IN ('cpf', 'cnpj')),
  document_number      TEXT NOT NULL UNIQUE,
  bio                  TEXT,
  photo_url            TEXT,
  rating_avg           NUMERIC(3,2) NOT NULL DEFAULT 0,
  rating_count         INTEGER      NOT NULL DEFAULT 0,
  verification_status  verification_status NOT NULL DEFAULT 'pending',
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ───────── Geography ─────────
CREATE TABLE states (
  id    SMALLINT PRIMARY KEY,           -- IBGE code
  uf    CHAR(2)  NOT NULL UNIQUE,
  name  TEXT     NOT NULL
);

CREATE TABLE cities (
  id         INTEGER PRIMARY KEY,       -- IBGE code
  state_id   SMALLINT NOT NULL REFERENCES states(id),
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL,
  UNIQUE (state_id, slug)
);
CREATE INDEX cities_name_trgm ON cities USING gin (name gin_trgm_ops);

-- ───────── Catalog ─────────
CREATE TABLE categories (
  id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  parent_id  INTEGER REFERENCES categories(id),
  name       TEXT    NOT NULL,
  slug       TEXT    NOT NULL UNIQUE,
  icon       TEXT,
  position   INTEGER NOT NULL DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE services (
  id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category_id  INTEGER NOT NULL REFERENCES categories(id),
  name         TEXT    NOT NULL,
  slug         TEXT    NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (category_id, slug)
);
CREATE INDEX services_name_trgm ON services USING gin (name gin_trgm_ops);

-- Dynamic request form per service
CREATE TABLE service_questions (
  id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  service_id   INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  label        TEXT NOT NULL,
  type         question_type NOT NULL,
  options      JSONB,                    -- for select / multi
  is_required  BOOLEAN NOT NULL DEFAULT false,
  position     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX service_questions_service_idx ON service_questions(service_id, position);

-- ───────── Professional offering ─────────
CREATE TABLE professional_services (
  pro_id      BIGINT  NOT NULL REFERENCES professionals(user_id) ON DELETE CASCADE,
  service_id  INTEGER NOT NULL REFERENCES services(id),
  PRIMARY KEY (pro_id, service_id)
);
CREATE INDEX professional_services_service_idx ON professional_services(service_id);

CREATE TABLE professional_coverage (
  pro_id   BIGINT  NOT NULL REFERENCES professionals(user_id) ON DELETE CASCADE,
  city_id  INTEGER NOT NULL REFERENCES cities(id),
  PRIMARY KEY (pro_id, city_id)
);
CREATE INDEX professional_coverage_city_idx ON professional_coverage(city_id);

-- ───────── Requests (client side) ─────────
CREATE TABLE requests (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  client_id       BIGINT  NOT NULL REFERENCES users(id),
  service_id      INTEGER NOT NULL REFERENCES services(id),
  city_id         INTEGER NOT NULL REFERENCES cities(id),
  description     TEXT,
  urgency         request_urgency NOT NULL DEFAULT 'flexible',
  status          request_status  NOT NULL DEFAULT 'open',
  max_leads       SMALLINT NOT NULL DEFAULT 4 CHECK (max_leads > 0),
  unlocked_count  SMALLINT NOT NULL DEFAULT 0,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT requests_unlocked_within_max CHECK (unlocked_count <= max_leads)
);
CREATE INDEX requests_match_idx  ON requests(service_id, city_id, status, created_at DESC);
CREATE INDEX requests_client_idx ON requests(client_id, created_at DESC);

CREATE TABLE request_answers (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id   BIGINT  NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  question_id  INTEGER NOT NULL REFERENCES service_questions(id),
  value        JSONB   NOT NULL,
  UNIQUE (request_id, question_id)
);

CREATE TABLE request_attachments (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id  BIGINT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  url         TEXT   NOT NULL,
  mime_type   TEXT   NOT NULL
);

-- ───────── Leads (a request offered to a professional) ─────────
CREATE TABLE leads (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id   BIGINT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  pro_id       BIGINT NOT NULL REFERENCES professionals(user_id),
  status       lead_status NOT NULL DEFAULT 'offered',
  coin_cost    INTEGER NOT NULL CHECK (coin_cost >= 0),   -- price frozen at offer time
  offered_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  unlocked_at  TIMESTAMPTZ,
  UNIQUE (request_id, pro_id)
);
CREATE INDEX leads_pro_idx ON leads(pro_id, status, offered_at DESC);

CREATE TABLE lead_pricing_rules (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  service_id  INTEGER NOT NULL REFERENCES services(id),
  city_id     INTEGER REFERENCES cities(id),              -- NULL = default for the service
  coin_cost   INTEGER NOT NULL CHECK (coin_cost >= 0),
  valid_from  TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_to    TIMESTAMPTZ
);
CREATE INDEX lead_pricing_lookup_idx ON lead_pricing_rules(service_id, city_id, valid_from DESC);

-- ───────── Coins: packages, payments, wallet, ledger ─────────
CREATE TABLE coin_packages (
  id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name         TEXT    NOT NULL,
  coins        INTEGER NOT NULL CHECK (coins > 0),
  price_cents  INTEGER NOT NULL CHECK (price_cents > 0),
  is_active    BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE payments (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pro_id        BIGINT  NOT NULL REFERENCES professionals(user_id),
  package_id    INTEGER NOT NULL REFERENCES coin_packages(id),
  method        payment_method NOT NULL,
  status        payment_status NOT NULL DEFAULT 'pending',
  amount_cents  INTEGER NOT NULL CHECK (amount_cents > 0),
  gateway       TEXT    NOT NULL,
  gateway_ref   TEXT    NOT NULL,
  paid_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (gateway, gateway_ref)
);
CREATE INDEX payments_pro_idx ON payments(pro_id, created_at DESC);

-- Cache of the balance. NEVER update directly: it is maintained by the trigger below.
CREATE TABLE wallets (
  pro_id      BIGINT PRIMARY KEY REFERENCES professionals(user_id),
  balance     INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Immutable ledger. Positive amount = credit, negative = debit.
CREATE TABLE coin_transactions (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pro_id           BIGINT NOT NULL REFERENCES professionals(user_id),
  type             coin_tx_type NOT NULL,
  amount           INTEGER NOT NULL CHECK (amount <> 0),
  balance_after    INTEGER NOT NULL,                    -- filled by trigger
  lead_id          BIGINT REFERENCES leads(id),
  payment_id       BIGINT REFERENCES payments(id),
  idempotency_key  TEXT NOT NULL UNIQUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT coin_tx_sign CHECK (
    (type = 'unlock' AND amount < 0) OR
    (type IN ('purchase', 'refund', 'bonus') AND amount > 0) OR
    (type = 'adjust')
  )
);
CREATE INDEX coin_tx_pro_idx ON coin_transactions(pro_id, created_at DESC);

CREATE FUNCTION apply_coin_transaction() RETURNS trigger AS $$
DECLARE
  new_balance INTEGER;
BEGIN
  INSERT INTO wallets (pro_id, balance) VALUES (NEW.pro_id, 0)
    ON CONFLICT (pro_id) DO NOTHING;

  -- The UPDATE takes a row lock; the CHECK (balance >= 0) blocks overdrafts.
  UPDATE wallets
     SET balance = balance + NEW.amount, updated_at = now()
   WHERE pro_id = NEW.pro_id
   RETURNING balance INTO new_balance;

  NEW.balance_after := new_balance;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER coin_transactions_apply
  BEFORE INSERT ON coin_transactions
  FOR EACH ROW EXECUTE FUNCTION apply_coin_transaction();

CREATE FUNCTION forbid_ledger_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'coin_transactions is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER coin_transactions_immutable
  BEFORE UPDATE OR DELETE ON coin_transactions
  FOR EACH ROW EXECUTE FUNCTION forbid_ledger_mutation();

-- ───────── Trust & moderation ─────────
CREATE TABLE reviews (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lead_id     BIGINT NOT NULL UNIQUE REFERENCES leads(id),
  client_id   BIGINT NOT NULL REFERENCES users(id),
  pro_id      BIGINT NOT NULL REFERENCES professionals(user_id),
  rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  pro_reply   TEXT,
  status      review_status NOT NULL DEFAULT 'pending',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX reviews_pro_idx ON reviews(pro_id, status, created_at DESC);

CREATE TABLE refund_requests (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lead_id      BIGINT NOT NULL UNIQUE REFERENCES leads(id),
  reason       TEXT   NOT NULL,
  status       refund_status NOT NULL DEFAULT 'pending',
  resolved_by  BIGINT REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE reports (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reporter_id  BIGINT NOT NULL REFERENCES users(id),
  target_type  TEXT   NOT NULL,
  target_id    BIGINT NOT NULL,
  reason       TEXT   NOT NULL,
  status       TEXT   NOT NULL DEFAULT 'open',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ───────── Operations ─────────
CREATE TABLE notifications (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel     TEXT   NOT NULL CHECK (channel IN ('push', 'email', 'sms', 'whatsapp')),
  template    TEXT   NOT NULL,
  payload     JSONB  NOT NULL DEFAULT '{}',
  sent_at     TIMESTAMPTZ,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON notifications(user_id, created_at DESC);

CREATE TABLE audit_logs (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id    BIGINT REFERENCES users(id),
  action      TEXT   NOT NULL,
  entity      TEXT   NOT NULL,
  entity_id   BIGINT,
  diff        JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_entity_idx ON audit_logs(entity, entity_id);
