# SecureWatch Events

## RabbitMQ Exchanges

- `securewatch.tasks`: processing tasks by type.
- `securewatch.events`: domain events for the dashboard, audit trail, and notifications.
- `securewatch.dlx`: dead-letter exchange for exhausted tasks.

## Queues

- `tasks.text`
- `tasks.document`
- `tasks.image`
- `tasks.audio`
- `tasks.dead_letter`

## Initial Events

All events should include:

- `event_id`
- `event_type`
- `occurred_at`
- `producer`
- `aggregate_type`
- `aggregate_id`
- `trace_id`
- `payload`

### `evidence.uploaded`

Emitted when evidence has been stored in MinIO and its metadata exists in PostgreSQL.

Suggested payload:

- `case_id`
- `evidence_id`
- `uploaded_by`
- `original_filename`
- `mime_type`
- `size_bytes`
- `hash_sha256`
- `storage_path`

### `evidence.classified`

Emitted when the Task Orchestrator determines the evidence type.

Suggested payload:

- `case_id`
- `evidence_id`
- `file_type`
- `previous_status`
- `new_status`

### `task.created`

Emitted when a persisted task is created.

Suggested payload:

- `task_id`
- `case_id`
- `evidence_id`
- `task_type`
- `queue_name`
- `priority`
- `max_retries`

### `task.queued`

Emitted when a task is successfully published to RabbitMQ.

Suggested payload:

- `task_id`
- `case_id`
- `evidence_id`
- `queue_name`
- `routing_key`

### `task.status_changed`

Emitted when a task state changes.

Suggested payload:

- `task_id`
- `case_id`
- `evidence_id`
- `previous_status`
- `new_status`
- `worker_id`
- `retry_count`
- `error_message`

### `task.failed`

Emitted when a task fails and either will retry or has been moved to the dead-letter queue.

Suggested payload:

- `task_id`
- `case_id`
- `evidence_id`
- `task_type`
- `retry_count`
- `max_retries`
- `dead_lettered`
- `error_message`

### `finding.created`

Emitted when a worker registers a finding.

Suggested payload:

- `finding_id`
- `case_id`
- `evidence_id`
- `task_id`
- `category`
- `severity`
- `confidence`
- `title`

### `case.risk_updated`

Emitted when the consolidated risk score changes.

Suggested payload:

- `case_id`
- `previous_risk_score`
- `new_risk_score`
- `highest_severity`
- `finding_count`

### `report.generated`

Emitted when a final report is generated and stored.

Suggested payload:

- `report_id`
- `case_id`
- `status`
- `risk_score`
- `file_path`
- `generated_at`

### `notification.created`

Emitted when an internal alert is created for a relevant finding.

Suggested payload:

- `notification_id`
- `case_id`
- `finding_id`
- `severity`
- `recipient_role`
