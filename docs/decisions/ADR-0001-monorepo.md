# ADR-0001: Monorepo for SecureWatch

## Status

Accepted.

## Context

SecureWatch requires a web frontend, multiple Go services, Python workers, shared contracts, reproducible local infrastructure, and technical documentation. Splitting everything into separate repositories would add friction before validating the MVP.

## Decision

Use a monorepo with explicit separation by component type:

- `apps/` for user-facing applications.
- `services/` for decoupled backend services.
- `workers/` for specialized asynchronous processing.
- `packages/` for shared contracts and utilities.
- `infra/` for local infrastructure and operational configuration.
- `docs/` for architecture, decisions, and roadmap.
- `scripts/` for automation and load testing.

## Consequences

- The MVP can evolve through coordinated changes across frontend, services, and workers.
- Event contracts and DTOs remain visible to every component.
- Discipline is required to avoid improper coupling between services.
- Lint, test, and build automation must be added per workspace as components grow.
