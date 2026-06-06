# API Gateway Endpoints

The API Gateway is the public HTTP entry point for the SecureWatch frontend.

## Base URL

Local Docker default:

```text
http://localhost:8080
```

## Public Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/healthz` | Process health check for Docker and local diagnostics. |
| `GET` | `/readyz` | Readiness check for API Gateway availability. |
| `GET` | `/metrics` | Prometheus-compatible metrics endpoint. |

## Protected Endpoints

Protected endpoints require:

```text
Authorization: Bearer <jwt>
```

The current middleware validates HS256 JWT signatures using `JWT_SECRET`.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/v1` | API index with initial route list. |
| `GET` | `/api/v1/me` | Returns the decoded token claims for the authenticated request. |

## CORS

CORS is configured through environment variables:

- `CORS_ALLOWED_ORIGINS`
- `CORS_ALLOWED_METHODS`
- `CORS_ALLOWED_HEADERS`

Local defaults allow:

- `http://localhost:3000`
- `http://127.0.0.1:3000`

## Logging

Every request is logged as structured JSON with:

- HTTP method
- Path
- Status code
- Duration in milliseconds
- Request ID
- Remote address

If the client does not provide `X-Request-ID`, the API Gateway generates one and returns it in the response.

## Local Verification

After starting Docker Compose:

```bash
make check-api-gateway
```
