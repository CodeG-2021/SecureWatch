#!/usr/bin/env bash
set -euo pipefail

compose() {
  docker compose "$@"
}

require_running() {
  local service="$1"
  local id
  id="$(compose ps -q "$service")"

  if [[ -z "$id" ]]; then
    echo "ERROR: $service is not created. Run: make up"
    exit 1
  fi

  if [[ "$(docker inspect -f '{{.State.Running}}' "$id")" != "true" ]]; then
    echo "ERROR: $service is not running. Run: make up"
    exit 1
  fi
}

echo "Checking SecureWatch local infrastructure..."

for service in postgres rabbitmq minio prometheus grafana; do
  require_running "$service"
  echo "OK: $service container is running"
done

compose exec -T postgres pg_isready \
  -U "${POSTGRES_USER:-securewatch}" \
  -d "${POSTGRES_DB:-securewatch}" >/dev/null
echo "OK: PostgreSQL accepts connections"

compose exec -T rabbitmq rabbitmq-diagnostics -q ping >/dev/null
echo "OK: RabbitMQ accepts diagnostics ping"

compose exec -T minio mc ready local >/dev/null
echo "OK: MinIO is ready"

curl -fsS "http://localhost:${PROMETHEUS_PORT:-9090}/-/healthy" >/dev/null
echo "OK: Prometheus health endpoint is reachable"

curl -fsS "http://localhost:${GRAFANA_PORT:-3001}/api/health" >/dev/null
echo "OK: Grafana health endpoint is reachable"

echo "SecureWatch local infrastructure is healthy."
