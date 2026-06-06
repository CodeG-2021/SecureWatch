# Audio Worker

Python worker for audio.

Responsibilities:

- Consume tasks from the audio queue.
- Download audio from MinIO.
- Transcribe with Whisper or Vosk.
- Store the transcript as an artifact.
- Create a secondary text-analysis task.
- Store duration and processing-time metrics.
