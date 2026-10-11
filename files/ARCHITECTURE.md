# Arquitetura

**Monolito modular** (decisão ADR-001). Um deploy de API, um de web, um processo de worker — mesmo código-base.

```
Next.js (web, SSR/ISR)        App mobile (fase 2)
            \                       /
          NestJS API  /v1  (REST + zod)
  módulos: auth · catalog · requests · leads · wallet
           payments · reviews · notifications · admin
        /           |            \               \
  PostgreSQL      Redis       BullMQ workers      S3
```

## Módulos da API (`apps/api/src/modules/<nome>`)

| Módulo | Responsabilidade |
|---|---|
| `auth` | Cadastro, login, refresh, OTP de telefone, papéis |
| `catalog` | Categorias, serviços, perguntas, cidades |
| `requests` | Criar/listar/cancelar pedidos (cliente) |
| `leads` | Matching, listagem para o profissional, **desbloqueio** |
| `wallet` | Ledger, saldo, extrato |
| `payments` | Pacotes, criação de cobrança, **webhook** do gateway |
| `reviews` | Avaliações, resposta, moderação |
| `notifications` | Push, e-mail, SMS, WhatsApp (via fila) |
| `admin` | Catálogo, preços, reembolsos, moderação |

Cada módulo expõe um service; módulos **não acessam tabelas de outros módulos diretamente** — chamam o service do dono.

## Fluxos críticos

**1. Criar pedido** → valida com zod → grava `requests` + `request_answers` → publica job `match-request`.

**2. Matching (worker)** → busca pros por `professional_services` ∩ `professional_coverage` (serviço + cidade), `verification_status` ≠ `rejected`, conta ativa → ordena por nota, tempo de resposta e atividade → cria `leads` (com `coin_cost` congelado) → enfileira notificações. Limita o nº de pros por pedido (ex.: 20) para evitar spam.

**3. Desbloqueio** → ver sequência transacional em `docs/DATABASE.md`.

**4. Compra de moedas** → API cria `payments(pending)` e a cobrança no gateway → o **webhook** (assinatura validada, idempotente) marca `paid` e insere `coin_transactions(purchase)`. Nunca credite moedas fora do webhook/ações de admin.

**5. Expiração** → job periódico fecha pedidos com `expires_at` vencido.

## Convenções de API

- REST em `/v1`, JSON. Autenticação por `Authorization: Bearer` (access) + cookie `httpOnly` (refresh).
- Paginação por cursor: `?cursor=&limit=` (máx. 50).
- Erros: `{ "error": { "code": "LEAD_ALREADY_UNLOCKED", "message": "..." } }` com HTTP semântico.
- Header `Idempotency-Key` obrigatório em `POST /v1/leads/:id/unlock` e criação de cobranças.
- Rotas principais (rascunho): `POST /auth/register`, `POST /auth/login`, `GET /catalog/services`, `POST /requests`, `GET /pro/leads`, `POST /leads/:id/unlock`, `GET /pro/wallet`, `POST /pro/wallet/purchase`, `POST /webhooks/payments`.

## SEO (web)

Rotas públicas `/{categoria}/{servico}/{uf}/{cidade}` geradas com ISR; metadados, `schema.org` (`Service`, `AggregateRating`), sitemap dinâmico. Formulário de pedido acessível já na página de serviço.

## Jobs (BullMQ)

`match-request`, `send-notification`, `expire-requests` (cron), `reconcile-payments` (cron), `recalc-rating`.

## Observabilidade

Logs estruturados (pino) com `requestId`, Sentry, métricas de fila e de funil (pedido → lead → desbloqueio → avaliação).

## Variáveis de ambiente

Ver `.env.example`. Nunca leia `process.env` fora de um módulo de config validado por zod.
