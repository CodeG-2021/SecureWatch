# Database

Migrations and seed data for PostgreSQL.

Initial entities from the requirements:

- `users`
- `cases`
- `evidences`
- `tasks`
- `findings`
- `reports`
- `audit_logs`
- `notifications`

The migration tool will be selected when the first Go service is implemented. Reasonable candidates include `goose`, `migrate`, or service-owned migrations.

Local PostgreSQL is defined in the root Docker Compose file and documented in [Local Infrastructure](../../docs/local-infrastructure.md).
