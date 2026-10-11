ALTER TABLE professionals ADD COLUMN fixed_pricing_enabled BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE fixed_price_offers (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pro_id BIGINT NOT NULL REFERENCES professionals(user_id),
  service_id INTEGER NOT NULL REFERENCES services(id),
  city_id INTEGER NOT NULL REFERENCES cities(id),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 5 AND 100),
  description TEXT NOT NULL CHECK (char_length(description) BETWEEN 15 AND 1200),
  price_cents INTEGER NOT NULL CHECK (price_cents BETWEEN 1 AND 100000000),
  unit TEXT NOT NULL CHECK (unit IN ('service', 'visit', 'hour', 'day')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX fixed_price_offers_pro_idx ON fixed_price_offers(pro_id);
CREATE INDEX fixed_price_offers_catalog_idx ON fixed_price_offers(city_id, service_id) WHERE active;
