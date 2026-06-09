#!/usr/bin/env bash
set -euo pipefail

base_url="${API_BASE_URL:-http://localhost:${API_GATEWAY_PORT:-8080}}"
email="agent.$(date +%s)@securewatch.local"

echo "Checking SecureWatch registration flow at $base_url..."

response="$(curl -fsS -X POST "$base_url/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Jane Doe\",\"email\":\"$email\",\"password\":\"Password!\",\"role\":\"analyst\"}")"

echo "$response" | grep -q "\"email\":\"$email\""
echo "$response" | grep -q '"role":"analyst"'

if echo "$response" | grep -q "password"; then
  echo "ERROR: registration response leaked password data"
  exit 1
fi

echo "OK: registration endpoint created a user and returned a safe response."
