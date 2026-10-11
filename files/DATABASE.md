# Banco de dados

Schema completo e **fonte da verdade**: `db/migrations/0001_init.sql` (PostgreSQL 15+, testado em 16). Seeds de desenvolvimento: `db/seeds/`.

## Mapa

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
2. `make db-reset` e confirme que tudo aplica do zero.
3. Atualize os tipos do Kysely e este documento se uma invariante mudar.
4. Em produção, migrations rodam no deploy, antes da nova versão da API.
