# Commit Convention

SecureWatch uses Conventional Commits to keep the Git history readable and to make future changelog or release automation easier.

## Format

```text
<type>(optional-scope): <short description>
```

Examples:

```text
feat(api-gateway): add health check endpoint
fix(evidence-service): reject empty uploads
docs(architecture): document RabbitMQ task flow
chore(monorepo): add base workspace structure
```

## Allowed Types

- `feat`: a new feature.
- `fix`: a bug fix.
- `docs`: documentation-only changes.
- `style`: formatting changes that do not affect behavior.
- `refactor`: code changes that neither fix a bug nor add a feature.
- `perf`: performance improvements.
- `test`: adding or updating tests.
- `build`: build system, dependency, or packaging changes.
- `ci`: CI/CD configuration changes.
- `chore`: maintenance tasks that do not modify application behavior.
- `revert`: reverts a previous commit.

## Recommended Scopes

Use scopes that match the monorepo component being changed:

- `web`
- `api-gateway`
- `auth-service`
- `case-service`
- `evidence-service`
- `task-orchestrator`
- `report-service`
- `notification-service`
- `text-worker`
- `document-worker`
- `image-worker`
- `audio-worker`
- `contracts`
- `infra`
- `docs`
- `monorepo`

## Writing Guidelines

- Use English for every commit message.
- Use the imperative mood: `add`, `fix`, `update`, `remove`.
- Keep the subject short and specific.
- Do not end the subject with a period.
- Prefer one logical change per commit.

## Breaking Changes

For breaking changes, add `!` after the type or scope:

```text
feat(contracts)!: rename task status values
```

Include a body explaining the migration impact when the change affects APIs, events, database schemas, or shared contracts.
