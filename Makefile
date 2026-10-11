.PHONY: setup dev test lint typecheck check build sync-catalog db-up db-down db-migrate db-verify test-postgres import-local
setup:
	pnpm install
	@test -f .env || cp .env.example .env
dev:
	pnpm dev
test:
	pnpm test
lint:
	pnpm lint
typecheck:
	pnpm typecheck
check:
	pnpm check
build:
	pnpm build
sync-catalog:
	pnpm sync-catalog
db-up:
	docker compose up -d --wait
db-down:
	docker compose down
db-migrate:
	pnpm db-migrate
db-verify:
	pnpm db-verify
test-postgres:
	pnpm test-postgres
import-local:
	pnpm import-local
