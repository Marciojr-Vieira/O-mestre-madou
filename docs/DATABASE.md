# Banco de dados

> A baseline `0001_init.sql` foi preservada. `0002_runtime.sql` acrescenta consentimento, refresh rotativo, desafios OTP, idempotência de operações e snapshot de moedas no pagamento. Os seeds ativos configuram Palmas, Tocantins, dez categorias e 111 serviços. No modo embarcado, o carregador adapta apenas citext/pg_trgm, ausentes na distribuição usada; PostgreSQL externo executa as migrations sem adaptações.

Schema completo e **fonte da verdade**: a soma dos arquivos em `db/migrations/` e `db/seeds/`. A baseline `0001_init.sql` permanece intacta. DDL, catálogo e 20 testes externos de domínio/HTTP/segurança foram validados na Supabase PostgreSQL 17.11, incluindo concorrência financeira e migrations simultâneas.

## Supabase

Projeto `catfliwcaezqtgakaxwa`, schema privado `elo`. `0004_backend_security.sql` habilita RLS nas 28 tabelas e concede apenas as operações necessárias ao papel `elo_runtime`. Papéis `anon`, `authenticated` e `service_role` não recebem acesso às tabelas do Elo. O navegador continua consumindo a API NestJS, que verifica autoria, papel e desbloqueio antes de devolver contatos.

O trigger de ledger executa como seu proprietário com `search_path` fixo. A API pode inserir lançamentos e criar uma carteira com saldo padrão zero; não pode escrever na coluna `balance`, atualizar ou excluir lançamentos. O papel da API não é proprietário das tabelas e não ignora RLS. `0005_supabase_event_trigger_permissions.sql` remove permissões de execução desnecessárias da função de evento `public.rls_auto_enable()`, quando ela existe, preservando o gatilho automático da Supabase.

Pool nativo `pg`, seis conexões por padrão, TLS com verificação, tempo de conexão de dez segundos e limite de execução SQL de quinze segundos. O hook assíncrono onConnect configura e verifica o papel em toda conexão física; não depende do parâmetro de startup, que foi ignorado pelo pooler. Também aplica search_path, timeout e application_name. Identificadores bigint retornam como números somente dentro do limite inteiro seguro do JavaScript. Migração usa uma conexão fixada, advisory lock por schema e uma transação por arquivo. A API pode iniciar com migração desabilitada e falha explicitamente se encontrar arquivos pendentes. Execute `db-migrate`, `db-verify` e `test-postgres` pelo make.ps1/Makefile.

As consultas remotas confirmaram dez categorias, 111 serviços, Palmas, ausência de formulários/preços faltantes, RLS completo e zero divergências de carteira/ledger ou slots/desbloqueios. O advisor de segurança retornou zero alertas após a migration 0005. A suíte externa passou com o papel restrito ativo, incluindo reconexões após erros e limite de quatro profissionais concorrentes. Os schemas e papéis temporários de teste foram removidos. Pagamentos e SMS reais continuam exigindo integração com provedores.

## Mapa

Preço Fechado foi adicionado em `0003_fixed_prices.sql`: `professionals.fixed_pricing_enabled` começa desabilitado; `fixed_price_offers` registra autor, serviço, cidade, título, escopo, preço em centavos, unidade, ativação e timestamps. Preço inteiro entre 1 e 100.000.000 centavos, unidade entre service/visit/hour/day, referências e limites de texto também são verificados no banco. A API restringe cidade a Palmas e valida autoria e cobertura em transação. A consulta pública aplica aprovação, telefone, conta ativa, adesão, oferta ativa e cobertura atual. Essas ofertas não debitam moedas nem criam pagamentos.

O schema atual é a soma das migrations versionadas. A API usa Supabase; DATA_DIR preserva a referência ao banco local recuperado e não é aberto no modo postgres. A recuperação está registrada na ADR-009 e a importação do histórico na ADR-011. Ledger, triggers e migrations anteriores foram preservados.

Importação de 08/10/2026: sete pedidos, 42 leads, 12 respostas, 43 notificações, duas sessões e um débito histórico. Contas e bônus correspondentes foram conciliados; saldo calculado exclusivamente pelo ledger. Marcador de auditoria impede repetir a mesma origem, inclusive em concorrência. O comando import-local depende do export privado desta entrega, não substitui migrations e recusa snapshots com dados adicionais sem mapeamento.

- **Identidade:** `users`, `professionals`
- **Geografia:** `states`, `cities` (IDs = códigos IBGE)
- **Catálogo:** `categories` (árvore), `services`, `service_questions` (formulário dinâmico)
- **Oferta do pro:** `professional_services`, `professional_coverage`
- **Pedidos:** `requests`, `request_answers`, `request_attachments`
- **Leads:** `leads`, `lead_pricing_rules`
- **Moedas:** `coin_packages`, `payments`, `wallets` (cache), `coin_transactions` (ledger)
- **Confiança:** `reviews`, `refund_requests`, `reports`
- **Operação:** `notifications`, `audit_logs`

## Invariantes garantidas PELO BANCO (não as reimplemente de forma divergente)

| Invariante | Mecanismo |
|---|---|
| Saldo nunca negativo | `CHECK (balance >= 0)` em `wallets` |
| `wallets.balance` e `balance_after` sempre coerentes | trigger `coin_transactions_apply` (BEFORE INSERT) |
| Ledger imutável | trigger `coin_transactions_immutable` bloqueia UPDATE/DELETE |
| Sinal correto do movimento | `unlock` < 0; `purchase`/`refund`/`bonus` > 0 |
| Movimento idempotente | `UNIQUE (idempotency_key)` |
| Nunca mais desbloqueios que o limite | `CHECK (unlocked_count <= max_leads)` |
| Um lead por (pedido, pro) | `UNIQUE (request_id, pro_id)` em `leads` |
| Uma avaliação por lead | `UNIQUE (lead_id)` em `reviews` |
| Um pagamento por referência do gateway | `UNIQUE (gateway, gateway_ref)` |

## Sequência do desbloqueio (implementar exatamente assim, em UMA transação)

```sql
BEGIN;
-- 1. Trava o pedido (serializa desbloqueios concorrentes do mesmo pedido)
SELECT id, status, unlocked_count, max_leads FROM requests WHERE id = :request_id FOR UPDATE;
-- 2. Valida: status = 'open' E unlocked_count < max_leads, senão ROLLBACK com erro REQUEST_FULL
-- 3. Trava e valida o lead: pertence ao pro autenticado e status IN ('offered','viewed')
SELECT id, coin_cost, status FROM leads WHERE id = :lead_id AND pro_id = :pro_id FOR UPDATE;
-- 4. Débito no ledger (o trigger atualiza o saldo; saldo insuficiente → erro de CHECK → INSUFFICIENT_COINS)
INSERT INTO coin_transactions (pro_id, type, amount, lead_id, idempotency_key)
VALUES (:pro_id, 'unlock', -:coin_cost, :lead_id, :idempotency_key);
-- 5. Atualiza lead e pedido
UPDATE leads    SET status = 'unlocked', unlocked_at = now() WHERE id = :lead_id;
UPDATE requests SET unlocked_count = unlocked_count + 1,
                    status = CASE WHEN unlocked_count + 1 >= max_leads THEN 'closed' ELSE status END
 WHERE id = :request_id;
COMMIT;
```

Tratamento de repetição: se o INSERT violar `idempotency_key`, a operação já foi feita — retorne o resultado anterior (HTTP 200), não erro.

## Preço do lead

```sql
SELECT coin_cost FROM lead_pricing_rules
 WHERE service_id = :service_id
   AND (city_id = :city_id OR city_id IS NULL)
   AND valid_from <= now() AND (valid_to IS NULL OR valid_to > now())
 ORDER BY city_id IS NULL, valid_from DESC
 LIMIT 1;
```

(regra específica da cidade vence a genérica). Se não houver regra, falhe a oferta e alerte — não use valor padrão silencioso.

## Como evoluir o schema

1. Crie `db/migrations/000N_descricao.sql` (nunca edite arquivos antigos).
2. Inicie a API com um banco de desenvolvimento vazio e confirme que as migrations/seeds aplicam do zero. O executor registra cada arquivo aplicado em `schema_migrations`; não altera bancos existentes para simular um reset.
3. Atualize os tipos TypeScript compartilhados e este documento se uma invariante mudar.
4. Em produção, aplique migrations com db-migrate antes de publicar a API; o build Netlify não altera o banco.

## Cadastros e ambientes

Migration 0006: users.city_id/neighborhood e application_settings com RLS. A configuração de acessos rápidos é uma linha única e só pode ser alterada pela API administrativa ou comando local do proprietário. Telefone confirmado manualmente registra a ação em audit_logs. Schema de produção: elo; demonstração local: elo_demo. Dados históricos de elo foram preservados. Cadastro profissional inclui perfil, associações e carteira vazia na transação de criação da conta. Sem lançamento financeiro nessa etapa.
