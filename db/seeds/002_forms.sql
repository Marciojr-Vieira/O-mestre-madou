INSERT INTO service_questions (service_id,label,type,options,is_required,position)
SELECT s.id, q.label, q.type::question_type, q.options::jsonb, true, q.position
FROM services s JOIN (VALUES
 ('diarista','Qual é o tipo de imóvel?','select','["Casa","Apartamento","Escritório"]',1),
 ('diarista','Quantos quartos tem o imóvel?','select','["1 quarto","2 quartos","3 quartos","4 ou mais"]',2),
 ('diarista','Com qual frequência precisa da limpeza?','select','["Uma vez","Toda semana","A cada 15 dias"]',3),
 ('eletricista','O que precisa ser feito?','select','["Instalação","Reparo","Inspeção elétrica"]',1),
 ('eletricista','Onde será o serviço?','select','["Casa","Apartamento","Comércio"]',2),
 ('encanador','Qual é o problema?','select','["Vazamento","Entupimento","Instalação","Outro reparo"]',1),
 ('encanador','Onde está o problema?','select','["Cozinha","Banheiro","Área externa","Outro local"]',2)
) AS q(slug,label,type,options,position) ON s.slug=q.slug;
INSERT INTO lead_pricing_rules (service_id,coin_cost) SELECT id, CASE slug WHEN 'diarista' THEN 6 WHEN 'eletricista' THEN 8 ELSE 7 END FROM services;
