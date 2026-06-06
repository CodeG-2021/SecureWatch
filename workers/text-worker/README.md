# Text Worker

Python worker for processing text, exported conversations, and transcripts.

Responsibilities:

- Consume tasks from the text queue.
- Read evidence from MinIO.
- Normalize text.
- Detect keywords, categories, sentiment, and risks.
- Store findings associated with the case, evidence, and task.
