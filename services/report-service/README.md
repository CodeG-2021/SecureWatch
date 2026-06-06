# Report Service

Service for consolidated case reports.

Responsibilities:

- Query cases, evidence, tasks, workers, and findings.
- Calculate the consolidated summary and risk score.
- Generate report PDFs.
- Store reports in MinIO.
- Register report metadata in PostgreSQL.
- Expose downloads or temporary URLs through the API Gateway.
