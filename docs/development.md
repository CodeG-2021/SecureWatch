# SecureWatch — Development Guide

---

## Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Docker Desktop | Latest | Run infrastructure + all services |
| Go | 1.22+ | Build and run Go services natively |
| Python | 3.11+ | Run workers natively |
| Node.js | 20+ | Frontend dev server |
| Make | Any | Task runner |

---

## First-Time Setup

```bash
# 1. Clone
git clone https://github.com/CodeG-2021/SecureWatch.git
cd SecureWatch

# 2. Environment
cp .env.example .env
# Edit .env — set passwords for POSTGRES_PASSWORD, RABBITMQ_DEFAULT_PASS,
# MINIO_ROOT_PASSWORD, JWT_SECRET, GRAFANA_ADMIN_PASSWORD

# 3. Install frontend dependencies
cd apps/web && npm install && cd ../..

# 4. Install Python worker dependencies (optional, they run in Docker)
cd services/workers
pip install -r text-worker/requirements.txt
pip install -r document-worker/requirements.txt
pip install -r image-worker/requirements.txt
pip install -r audio-worker/requirements.txt
pip install -r archive-worker/requirements.txt
cd ../..
```

---

## Daily Workflow

```bash
# Start everything
make up

# Stop everything
make down

# View Docker logs
make logs

# Check which containers are running
make ps
```

After `make up`, the frontend dev server is running at `http://localhost:3000` with hot reload.

---

## Environment Variables

`.env.example` contains all variables with safe local defaults. Never commit real secrets.

| Variable | Required | Default (example) | Description |
|---|---|---|---|
| `POSTGRES_PASSWORD` | Yes | `local-dev-password` | PostgreSQL password |
| `POSTGRES_USER` | No | `securewatch` | PostgreSQL user |
| `POSTGRES_DB` | No | `securewatch` | Database name |
| `RABBITMQ_DEFAULT_PASS` | Yes | `local-dev-password` | RabbitMQ password |
| `RABBITMQ_DEFAULT_USER` | No | `securewatch` | RabbitMQ user |
| `MINIO_ROOT_PASSWORD` | Yes | `local-dev-password` | MinIO root password |
| `MINIO_ROOT_USER` | No | `securewatch` | MinIO root user |
| `JWT_SECRET` | Yes | `local-dev-jwt-secret-min-32-chars` | HS256 signing key |
| `GRAFANA_ADMIN_PASSWORD` | Yes | `local-dev-admin` | Grafana password |
| `API_GATEWAY_PORT` | No | `8080` | API Gateway port |
| `AUTH_SERVICE_PORT` | No | `8081` | Auth Service port |
| `CASE_SERVICE_PORT` | No | `8082` | Case Service port |
| `EVIDENCE_SERVICE_PORT` | No | `8083` | Evidence Service port |
| `WEB_PORT` | No | `3000` | Frontend port |
| `CORS_ALLOWED_ORIGINS` | No | `http://localhost:3000,...` | CORS origins |

---

## Project Structure

```
SecureWatch/
├── apps/
│   └── web/
│       ├── src/
│       │   ├── components/     # Shared UI components (Sidebar, AppLayout, etc.)
│       │   ├── lib/            # API client, session, SSE hook
│       │   └── pages/          # One file per page/route
│       ├── index.html
│       └── vite.config.ts
│
├── services/
│   ├── api-gateway/
│   │   ├── cmd/api-gateway/main.go
│   │   └── internal/
│   │       ├── config/         # Env-based config
│   │       ├── http/           # Router, handlers, middleware
│   │       └── metrics/        # Prometheus metrics
│   │
│   ├── auth-service/           # Same structure as api-gateway
│   ├── case-service/
│   │   └── internal/
│   │       ├── audit/          # Fire-and-forget audit writer
│   │       ├── http/           # Handlers for cases, findings, notifications, reports, audit
│   │       ├── metrics/
│   │       └── storage/        # Repository pattern for each domain
│   │
│   └── evidence-service/
│       └── internal/
│           ├── audit/
│           ├── domain/         # allowedMIMETypes, Evidence model
│           ├── http/           # Upload handler, report handler, SSE
│           ├── metrics/
│           └── storage/        # Evidence repository, MinIO client
│
├── services/workers/
│   ├── base/                   # Shared: db.py, minio_client.py, rabbitmq.py
│   ├── text-worker/worker.py
│   ├── document-worker/worker.py
│   ├── image-worker/worker.py
│   ├── audio-worker/worker.py
│   └── archive-worker/worker.py
│
├── infra/
│   ├── database/init/          # SQL migrations 001–010
│   ├── docker/rabbitmq/        # definitions.json (exchanges, queues, DLQ)
│   ├── docker/prometheus/      # prometheus.yml
│   ├── docker/grafana/         # Provisioning + dashboard JSON
│   └── docker/minio/           # create-buckets.sh
│
├── docs/
├── docker-compose.yml
├── Makefile
└── .env.example
```

---

## Adding a New API Endpoint

### 1. Case Service or Evidence Service handler

```go
// services/case-service/internal/http/my_handler.go
func myHandler(logger *slog.Logger, repo *storage.MyRepo) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        // extract user from header: r.Header.Get("X-User-Id")
        // call repo
        // writeJSON(w, http.StatusOK, result)
    }
}
```

### 2. Register route in the service router

```go
// services/case-service/internal/http/router.go
mux.Handle("GET /my-endpoint", auth(myHandler(logger, myRepo)))
```

### 3. Add proxy in API Gateway

```go
// services/api-gateway/internal/http/router.go
mux.Handle("GET /api/v1/my-endpoint", auth(caseServiceProxy(cfg, logger, "/my-endpoint")))
```

### 4. Add to frontend API client

```typescript
// apps/web/src/lib/api.ts
export async function myEndpoint() {
    const res = await fetch(`${BASE}/api/v1/my-endpoint`, { headers: authHeaders() })
    return handleResponse<MyType>(res)
}
```

---

## Database Migrations

Migrations in `infra/database/init/` are mounted into the PostgreSQL container and run automatically on first start. For schema changes:

1. Add a new file: `infra/database/init/011_my_change.sql`
2. If Postgres is already running with data, apply manually:

```bash
make migrate-db
# or
docker exec -i securewatch-postgres psql -U securewatch -d securewatch < infra/database/init/011_my_change.sql
```

---

## Frontend Routing

The app uses a custom hash-free router in [`apps/web/src/App.tsx`](../apps/web/src/App.tsx). To add a new page:

1. Create `apps/web/src/pages/MyPage.tsx`
2. Add `import { MyPage } from "./pages/MyPage"` to `App.tsx`
3. Add a route match: `else if (path === "/my-page") { page = requireAuth(<MyPage />) }`
4. Add a sidebar link in `apps/web/src/components/Sidebar.tsx`

---

## Commit Convention

See [commit-convention.md](commit-convention.md) for the full format.

Quick reference:

```
feat(case-service): add bulk status update endpoint
fix(evidence-service): handle zero-byte file upload
docs: update API reference with new endpoints
refactor(workers): extract shared retry logic to base
```

Types: `feat` `fix` `docs` `refactor` `test` `chore` `ci`

---

## Logs

When running with `make up`, service logs go to `/tmp/securewatch-logs/`:

```bash
tail -f /tmp/securewatch-logs/api-gateway.log
tail -f /tmp/securewatch-logs/frontend.log
```

For Docker services (workers, Postgres, RabbitMQ):

```bash
make logs
# or
docker compose logs -f text-worker
docker compose logs -f postgres
```

---

## Useful Make Targets

```bash
make up              # Start full stack
make down            # Stop full stack
make logs            # Docker logs
make ps              # Container status
make migrate-db      # Apply migrations
make check-infra     # Verify connectivity
make check-api-gateway  # Smoke test API Gateway
```
