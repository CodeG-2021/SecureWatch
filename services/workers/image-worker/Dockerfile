FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev libglib2.0-0 libsm6 libxext6 libxrender-dev libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY base/ ./base/

COPY image-worker/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Haarcascades are bundled with opencv-python — no external download needed
# Verify they exist at build time so we fail fast if something's wrong
RUN python -c "import cv2; import os; assert os.path.exists(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'), 'haarcascades missing'"

COPY image-worker/ .

CMD ["python", "worker.py"]
