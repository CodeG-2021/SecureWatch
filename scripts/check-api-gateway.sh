#!/usr/bin/env bash
set -euo pipefail

base_url="${API_BASE_URL:-http://localhost:${API_GATEWAY_PORT:-8080}}"

echo "Checking SecureWatch API Gateway at $base_url..."

curl -fsS "$base_url/healthz" >/dev/null
echo "OK: /healthz is reachable"

curl -fsS "$base_url/readyz" >/dev/null
echo "OK: /readyz is reachable"

curl -fsS "$base_url/metrics" | grep -q "securewatch_api_gateway_up 1"
echo "OK: /metrics exposes Prometheus metrics"

status_code="$(curl -s -o /dev/null -w "%{http_code}" "$base_url/api/v1/me")"
if [[ "$status_code" != "401" ]]; then
  echo "ERROR: /api/v1/me should require authentication, got HTTP $status_code"
  exit 1
fi
echo "OK: protected routes require authentication"

echo "SecureWatch API Gateway is healthy."
