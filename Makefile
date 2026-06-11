.PHONY: help up down logs ps migrate-db check-infra check-api-gateway check-register fmt test lint clean

COMPOSE  = docker compose
ROOT     = $(shell pwd)
LOG_DIR  = /tmp/securewatch-logs

# All docker-compose services except the production web container
BACKEND_SERVICES = postgres rabbitmq minio minio-init \
                   auth-service case-service evidence-service api-gateway \
                   task-orchestrator \
                   text-worker document-worker image-worker audio-worker archive-worker \
                   prometheus grafana

help:
	@echo "SecureWatch monorepo"
	@echo "  make up          Start everything (Docker backend + Vite dev server on :3000)"
	@echo "  make down        Stop everything"
	@echo "  make logs        Stream Docker infrastructure logs"
	@echo "  make ps          List Docker Compose services"
	@echo "  make migrate-db  Apply local database migrations"

up:
	@mkdir -p $(LOG_DIR)
	@echo "▶ Starting Docker services..."
	@$(COMPOSE) up -d $(BACKEND_SERVICES)
	@echo "▶ Starting frontend dev server on http://localhost:3000 ..."
	@cd $(ROOT)/apps/web && npm run dev -- --port 3000 > $(LOG_DIR)/frontend.log 2>&1 &
	@echo ""
	@echo "✓ SecureWatch running at http://localhost:3000"
	@echo "  Grafana:    http://localhost:3001"
	@echo "  Prometheus: http://localhost:9090"
	@echo "  MinIO:      http://localhost:9001"
	@echo "  RabbitMQ:   http://localhost:15672"
	@echo "  Logs: $(LOG_DIR)/frontend.log"

down:
	@echo "▶ Stopping frontend dev server..."
	@-kill $$(lsof -t -i:3000) 2>/dev/null; true
	@echo "▶ Stopping Docker services..."
	@$(COMPOSE) down
	@echo ""
	@echo "✓ SecureWatch stopped"

logs:
	$(COMPOSE) logs -f

ps:
	$(COMPOSE) ps

migrate-db:
	./scripts/migrate-local-db.sh

check-infra:
	./scripts/check-local-infra.sh

check-api-gateway:
	./scripts/check-api-gateway.sh

check-register:
	./scripts/check-register.sh

fmt:
	@echo "Pending: run formatters per app, service, and worker."

test:
	@echo "Pending: run tests per app, service, and worker."

lint:
	@echo "Pending: run linters per app, service, and worker."

clean:
	rm -rf coverage dist build .pytest_cache .mypy_cache .ruff_cache
