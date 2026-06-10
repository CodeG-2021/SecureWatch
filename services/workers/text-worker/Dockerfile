FROM python:3.11-slim

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Shared base
COPY base/ ./base/

# Worker deps
COPY text-worker/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download spaCy model during build (direct wheel install — avoids DNS issues in Docker)
RUN pip install --no-cache-dir \
    https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.7.1/en_core_web_sm-3.7.1-py3-none-any.whl

COPY text-worker/ .

CMD ["python", "worker.py"]
