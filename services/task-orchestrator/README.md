# Task Orchestrator

Service for evidence classification, task creation, and queueing.

Responsibilities:

- Classify evidence by type: `text`, `image`, `audio`, `document`, `archive`.
- Create tasks with priority inherited from the case.
- Publish tasks to RabbitMQ.
- Configure retries and the dead-letter queue.
- Update task and evidence states.
- Ignore or cancel tasks that should no longer run.
