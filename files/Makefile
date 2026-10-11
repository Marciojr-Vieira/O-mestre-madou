# Interface única de comandos — usada por humanos, Codex e Claude Code.
SHELL := /bin/bash
-include .env
export

.PHONY: setup db-up db-down db-reset dev test lint typecheck check

setup:
	pnpm install
	@test -f .env || cp .env.example .env

db-up:
	docker compose up -d --wait

db-down:
	docker compose down

# Recria o banco local (APENAS desenvolvimento).
db-reset: db-up
	docker compose exec -T postgres psql -U $(POSTGRES_USER) -d postgres -c "DROP DATABASE IF EXISTS $(POSTGRES_DB);" -c "CREATE DATABASE $(POSTGRES_DB);"
	@for f in $$(ls db/migrations/*.sql | sort); do \
	  echo "migrate $$f"; \
	  docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -q -U $(POSTGRES_USER) -d $(POSTGRES_DB) < $$f || exit 1; \
	done
	@for f in $$(ls db/seeds/*.sql | sort); do \
	  echo "seed $$f"; \
	  docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -q -U $(POSTGRES_USER) -d $(POSTGRES_DB) < $$f || exit 1; \
	done

dev:
	pnpm -r --parallel dev

test:
	pnpm -r test

lint:
	pnpm -r lint

typecheck:
	pnpm -r typecheck

check: lint typecheck test
