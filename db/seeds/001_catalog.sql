-- Launch geography is defined in 003_tocantins.sql. Original references stay in files/.

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
