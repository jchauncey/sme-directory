# SME Directory — developer entrypoints.
# Run `make` (no args) to see available targets.

.DEFAULT_GOAL := help
.PHONY: help setup install dev build start lint typecheck format format-check check clean reset \
        db-migrate db-deploy db-reset db-seed db-studio

NODE_MODULES := node_modules/.package-lock.json

help: ## Show this help
	@awk 'BEGIN { FS = ":.*##"; printf "Targets:\n" } \
	  /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

setup: install .env db-deploy ## One-shot bootstrap (Conductor setup stage)

.env:
	@if [ ! -f .env ]; then \
	  echo "Creating .env from .env.example"; \
	  cp .env.example .env; \
	fi

$(NODE_MODULES): package.json package-lock.json
	npm install
	@touch $(NODE_MODULES)

install: $(NODE_MODULES) ## Install npm dependencies (idempotent)

dev: install ## Run the dev server on http://localhost:3000
	npm run dev

build: install ## Production build
	npm run build

start: build ## Run the production build
	npm start

lint: install ## ESLint
	npm run lint

typecheck: install ## TypeScript no-emit check
	npm run typecheck

format: install ## Prettier write
	npm run format

format-check: install ## Prettier check (no writes)
	npm run format:check

check: lint typecheck format-check ## Run all CI gates

clean: ## Remove build artifacts (keeps node_modules)
	rm -rf .next

reset: ## Remove build artifacts AND node_modules
	rm -rf .next node_modules

# --- Database (wired up in #2: Prisma + SQLite) ---

db-migrate: install ## Apply Prisma migrations (interactive — dev)
	npm run db:migrate

db-deploy: install ## Apply committed Prisma migrations (non-interactive)
	npx prisma migrate deploy

db-reset: install ## Reset the dev database (DESTRUCTIVE — wipes data)
	npm run db:reset

db-seed: ## Seed the dev database (TODO: #17)
	@echo "Not yet implemented — see issue #17 (seed data and dev fixtures)"

db-studio: install ## Open Prisma Studio
	npm run db:studio
