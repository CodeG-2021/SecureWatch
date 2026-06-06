# RabbitMQ

Expected messaging configuration.

## Exchanges

- `securewatch.tasks`
- `securewatch.events`
- `securewatch.dlx`

## MVP Queues

- `tasks.text`
- `tasks.document`
- `tasks.image`
- `tasks.audio`
- `tasks.dead_letter`

## Suggested Routing Keys

- `task.text`
- `task.document`
- `task.image`
- `task.audio`
- `task.failed`
- `case.status_changed`
- `evidence.uploaded`
- `finding.created`
- `report.generated`

The local RabbitMQ container loads its definitions from [infra/docker/rabbitmq/definitions.json](../docker/rabbitmq/definitions.json).
