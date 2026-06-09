.PHONY: help up down logs ps migrate-db check-infra check-api-gateway check-register fmt test lint clean

COMPOSE=docker compose

help:
	@echo "SecureWatch monorepo"
	@echo "  make up      Starts PostgreSQL, RabbitMQ, MinIO, Prometheus, and Grafana"
	@echo "  make down    Stops the local infrastructure"
	@echo "  make logs    Streams infrastructure logs"
	@echo "  make ps      Lists Docker Compose services"
	@echo "  make migrate-db  Applies local database migrations"
	@echo "  make check-infra  Verifies local infrastructure connectivity"
	@echo "  make check-api-gateway  Verifies API Gateway endpoints"
	@echo "  make check-register  Verifies user registration end to end"
	@echo "  make fmt     Entry point for workspace formatters"
	@echo "  make test    Entry point for workspace tests"
	@echo "  make lint    Entry point for workspace linters"
	@echo "  make clean   Removes common local artifacts"

up:
	$(COMPOSE) up -d

down:
	$(COMPOSE) down

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
