# Observability

SecureWatch must expose metrics, structured logs, and operational states.

## Initial Metrics

- Tasks processed by worker.
- Average duration by task type.
- Failed tasks by service.
- Tasks in retry.
- Evidence processed by case.
- Total processing time by case.

## Tools

- OpenTelemetry for instrumentation.
- Prometheus for scraping.
- Grafana for dashboards.
- Structured logs per service and worker.

Local Prometheus and Grafana provisioning is documented in [Local Infrastructure](../../docs/local-infrastructure.md).
