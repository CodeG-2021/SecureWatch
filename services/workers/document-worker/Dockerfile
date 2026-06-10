FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY base/ ./base/

COPY document-worker/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# spaCy model for inline text analysis
RUN pip install --no-cache-dir \
    https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.7.1/en_core_web_sm-3.7.1-py3-none-any.whl

# Make text analyzer importable from document worker
COPY text-worker/analyzer.py /app/text-worker-lib/analyzer.py
RUN touch /app/text-worker-lib/__init__.py

COPY document-worker/ .

CMD ["python", "worker.py"]
