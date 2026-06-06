# Services

Decoupled backend services, intended to be implemented in Go.

## Suggested Service Convention

```text
cmd/<service-name>/       Executable entry point.
internal/config/          Configuration loading.
internal/domain/          Entities, rules, and use cases.
internal/http/            HTTP handlers, routes, and middleware.
internal/messaging/       Event publishing or consumption.
internal/storage/         PostgreSQL, MinIO, or other persistence clients.
internal/observability/   Logs, metrics, and traces.
```

Not every service needs every folder on day one. The structure should grow as each service responsibility requires it.
