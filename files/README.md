# Servicos Marketplace

Marketplace de serviços no modelo GetNinjas (pedido grátis para o cliente, leads pagos com moedas para o profissional).

## Como Codex e Claude Code compartilham o mesmo contexto

| Ferramenta | Arquivo que ela lê | Conteúdo |
|---|---|---|
| Codex | `AGENTS.md` (nativo) | Instruções completas |
| Claude Code | `CLAUDE.md` | Apenas `@AGENTS.md` (importa o arquivo acima) |

Consequências:

- Existe **uma só fonte de regras**: `AGENTS.md`. Nunca edite regras no `CLAUDE.md`.
- Os dois agentes usam os mesmos comandos (`make …`) e os mesmos documentos em `docs/`.
- O **handoff** entre agentes é feito por arquivos versionados: `docs/ROADMAP.md` (estado e próxima tarefa) e `docs/DECISIONS.md` (decisões). Não dependa do histórico de chat.
- Se algum dia quiser eliminar até o import, troque `CLAUDE.md` por um symlink: `ln -sf AGENTS.md CLAUDE.md` (no Windows, prefira manter o import).

## Começando

```bash
make setup      # dependências + .env
make db-up      # Postgres + Redis
make db-reset   # migrations + seeds
make dev
```

## Mapa da documentação

- `docs/ROADMAP.md` — onde estamos e o que vem depois
- `docs/PRODUCT.md` — regras de negócio e glossário
- `docs/ARCHITECTURE.md` — arquitetura, módulos e fluxos
- `docs/DATABASE.md` — modelo de dados e invariantes
- `docs/DECISIONS.md` — registro de decisões (ADRs)
