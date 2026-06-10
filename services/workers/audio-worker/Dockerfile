FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY base/ ./base/

# Install CPU-only torch first to avoid downloading the 2GB CUDA variant
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

COPY audio-worker/requirements.txt .
# openai-whisper's setup.py needs pkg_resources from the host env, not an isolated build sandbox
RUN pip install --no-cache-dir --no-build-isolation -r requirements.txt

# spaCy model for inline text analysis
RUN pip install --no-cache-dir \
    https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.7.1/en_core_web_sm-3.7.1-py3-none-any.whl

# Text analyzer lib
COPY text-worker/analyzer.py /app/text-worker-lib/analyzer.py
RUN touch /app/text-worker-lib/__init__.py

COPY audio-worker/ .

ENV WHISPER_MODEL=base
ENV WHISPER_CACHE=/models/whisper

CMD ["python", "worker.py"]
