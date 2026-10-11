ALTER TABLE users ADD COLUMN city_id INTEGER REFERENCES cities(id);
ALTER TABLE users ADD COLUMN neighborhood TEXT NOT NULL DEFAULT '' CHECK (length(neighborhood)<=100);
CREATE INDEX users_city_id_idx ON users(city_id);

CREATE TABLE application_settings (
  singleton BOOLEAN PRIMARY KEY DEFAULT true CHECK (singleton),
  demo_login_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by BIGINT REFERENCES users(id)
);
CREATE INDEX application_settings_updated_by_idx ON application_settings(updated_by);
INSERT INTO application_settings(singleton) VALUES (true);
ALTER TABLE application_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON application_settings FROM PUBLIC;
DO $permissions$
DECLARE api_role TEXT;
BEGIN
  FOR api_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role') LOOP
    EXECUTE format('REVOKE ALL ON application_settings FROM %I',api_role);
  END LOOP;
END;
$permissions$;
CREATE POLICY elo_backend ON application_settings TO elo_runtime USING (true) WITH CHECK (true);
GRANT SELECT,UPDATE ON application_settings TO elo_runtime;
