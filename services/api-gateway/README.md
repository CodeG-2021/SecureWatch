# API Gateway

Main entry point for the frontend. It centralizes HTTP routes, CORS, authentication, logs, and real-time event exposure.

Responsibilities:

- Initial health check.
- Routing to internal services.
- JWT authentication middleware.
- Structured logging middleware.
- SSE or WebSocket channel for case and task updates.
- `/metrics` endpoint when applicable.

## Local Docker

The API Gateway is included in the root Docker Compose file.

```bash
docker compose up -d api-gateway
```

Default local URL:

```text
http://localhost:8080
```

## Documentation

- [API Gateway Endpoints](../../docs/api-gateway-endpoints.md)
