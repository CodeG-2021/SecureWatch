#!/usr/bin/env bash
set -euo pipefail

echo "Applying SecureWatch local database migrations..."

docker compose exec -T postgres psql \
  -U "${POSTGRES_USER:-securewatch}" \
  -d "${POSTGRES_DB:-securewatch}" \
  -f /docker-entrypoint-initdb.d/001_create_users.sql

echo "Database migrations applied."
