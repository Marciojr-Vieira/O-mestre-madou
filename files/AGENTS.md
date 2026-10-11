# AGENTS.md

> Fonte ÚNICA de instruções para agentes de código (Codex, Claude Code e humanos).
> `CLAUDE.md` apenas importa este arquivo. **Edite regras aqui, nunca duplique em outro lugar.**

## O que é este projeto

Marketplace de serviços no modelo GetNinjas: clientes publicam pedidos grátis, até **4 profissionais** desbloqueiam o contato pagando com **moedas** (sem comissão, sem mensalidade). O produto gira em torno de **vender leads**.

## Leia antes de trabalhar (nesta ordem)

1. `docs/ROADMAP.md` — estado atual e próxima tarefa. **Comece sempre por aqui.**
2. `docs/PRODUCT.md` — regras de negócio e glossário.
3. `docs/ARCHITECTURE.md` — módulos, fluxos e convenções de API.
4. `docs/DATABASE.md` e `db/migrations/` — modelo de dados e invariantes.
5. `docs/DECISIONS.md` — decisões já tomadas (não reabra sem registrar um novo ADR).

Carregue só o que a tarefa exige; não leia tudo por padrão.

## Stack

- Monorepo **pnpm** + TypeScript estrito.
- `apps/web`: Next.js (App Router, SSR/ISR para SEO).
- `apps/api`: NestJS (REST `/v1`), com entrypoint separado para workers (`src/worker.ts`).
- `packages/shared`: tipos e schemas **zod** compartilhados entre web e api.
- PostgreSQL 15+ (SQL puro em `db/migrations`), Redis, BullMQ, S3.
- Query builder: Kysely com tipos gerados do banco. Sem ORM com auto-sync.

## Estrutura

```
apps/web  apps/api  packages/shared
db/migrations  db/seeds
docs/
```

## Comandos (ÚNICA interface — use sempre `make`)

| Comando | O que faz |
|---|---|
| `make setup` | Instala dependências e copia `.env.example` → `.env` |
| `make db-up` / `make db-down` | Sobe/derruba Postgres e Redis (Docker) |
| `make db-reset` | Recria o banco, aplica migrations e seeds |
| `make dev` | Sobe web + api + worker |
| `make test` | Testes unitários e de integração |
| `make lint` | ESLint + Prettier (check) |
| `make typecheck` | `tsc --noEmit` em todos os pacotes |
| `make check` | lint + typecheck + test (**rode antes de concluir qualquer tarefa**) |

Se um comando não existir ainda, crie-o no `Makefile` e documente aqui em vez de usar um comando avulso.

## Regras invioláveis de domínio

1. **Carteira = ledger.** Todo movimento de moedas é um INSERT em `coin_transactions`. Nunca faça `UPDATE wallets`. Nunca edite/apague transações (o banco bloqueia).
2. **Desbloqueio é uma transação única**, com `SELECT … FOR UPDATE` em `requests`, verificação de `unlocked_count < max_leads`, débito no ledger e atualização do lead. Sequência exata em `docs/DATABASE.md`.
3. **Idempotência obrigatória** em webhooks de pagamento e desbloqueios (`idempotency_key`).
4. **Preço do lead é congelado** em `leads.coin_cost` na oferta. Mudanças de regra não afetam leads já ofertados.
5. **Contato do cliente (nome completo, telefone, e-mail, endereço exato) só é exposto a quem desbloqueou.** Nenhum endpoint de listagem pode vazá-lo.
6. **Migrations são imutáveis** depois de mergeadas. Mudou o schema? Crie `000N_descricao.sql`.
7. **Nunca confie no cliente** para preço, saldo ou status: tudo é recalculado no servidor.

## Convenções de código

- Identificadores, commits e comentários em **inglês**; textos de UI, docs e mensagens ao usuário em **pt-BR**.
- Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`…). Um commit = uma mudança lógica.
- Validação de entrada com **zod** na borda; erros de API no formato `{ "error": { "code": "...", "message": "..." } }`.
- Dinheiro sempre em **centavos (inteiro)**. Datas em UTC (`timestamptz`); telefones em E.164.
- Sem `any`. Sem `console.log` (use o logger). Sem segredos no código.
- Toda regra de domínio nova ganha teste. Fluxos de carteira/desbloqueio exigem teste de concorrência.

## Fluxo de trabalho (vale para qualquer agente)

1. Leia `docs/ROADMAP.md` e escolha a tarefa indicada em **"Próxima tarefa"** (ou a que o usuário pediu).
2. Trabalhe em um branch `feat/<id-da-tarefa>-<slug>`; mudanças pequenas e verificáveis.
3. Rode `make check`. Não conclua com falhas.
4. **Handoff:** ao terminar, atualize `docs/ROADMAP.md` (marque a tarefa, atualize "Estado atual" e "Próxima tarefa", adicione uma linha no "Log de sessões") e registre decisões relevantes em `docs/DECISIONS.md`. Outro agente deve conseguir continuar só lendo esses arquivos.
5. Se algo for ambíguo e mudar o rumo do produto, pergunte em vez de assumir; se for detalhe de implementação, decida e registre.

## Segurança e LGPD

- Senhas com Argon2id. Auth: JWT de acesso curto + refresh em cookie `httpOnly`. Verificação de telefone por OTP.
- Rate limit em login, OTP e criação de pedidos. Valide uploads (tipo, tamanho) e use URLs assinadas do S3.
- Logs sem dados pessoais. Registre consentimento; suporte a exclusão/anonimização de conta.
- Nunca commite `.env`, chaves de gateway ou dumps com dados reais.

## Definição de pronto

Código + testes + `make check` verde + docs/ROADMAP atualizado + migration (se houver) + sem TODO sem dono.
