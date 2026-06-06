# Evidence Service

Service for digital evidence upload, validation, and metadata.

Responsibilities:

- Receive multipart files associated with cases.
- Validate size, extension, MIME type, and empty files.
- Calculate SHA-256 hashes and detect duplicates.
- Store original files in MinIO.
- Persist metadata in PostgreSQL.
- Notify the Task Orchestrator when new evidence exists.
