# Image Worker

Python worker for basic image analysis.

Responsibilities:

- Consume tasks from the image queue.
- Download images from MinIO.
- Run analysis with OpenCV or pretrained models.
- Generate labels and possible risk elements.
- Store findings and processing metrics.
