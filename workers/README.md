# Workers

Specialized Python processors, decoupled by queue and evidence type.

## Suggested Worker Convention

```text
src/<package_name>/       Worker code.
tests/                    Unit and local integration tests.
README.md                 Responsibility, consumed queue, and dependencies.
```

Workers must be horizontally replicable to demonstrate performance gains when increasing instances.
