-- Pilot seed: Goiás + launch categories. Run on a fresh database (make db-reset).
INSERT INTO states (id, uf, name) VALUES (52, 'GO', 'Goiás');

INSERT INTO cities (id, state_id, name, slug) VALUES
  (5208707, 52, 'Goiânia', 'goiania'),
  (5201405, 52, 'Aparecida de Goiânia', 'aparecida-de-goiania'),
  (5208004, 52, 'Jandaia', 'jandaia');

INSERT INTO categories (name, slug, position) VALUES
  ('Serviços Domésticos', 'familia', 1),
  ('Reformas e Reparos', 'reformas-e-reparos', 2);

INSERT INTO services (category_id, name, slug)
SELECT c.id, v.name, v.slug
FROM categories c
JOIN (VALUES
  ('familia',            'Diarista',    'diarista'),
  ('reformas-e-reparos', 'Eletricista', 'eletricista'),
  ('reformas-e-reparos', 'Encanador',   'encanador')
) AS v(cat, name, slug) ON v.cat = c.slug;

INSERT INTO coin_packages (name, coins, price_cents) VALUES
  ('Básico', 20, 2000),
  ('Plus',   60, 5400),
  ('Pro',   150, 11250);
