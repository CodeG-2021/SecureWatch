"""
Audio transcription using openai-whisper (HU-19).
Uses the 'base' model — good quality/speed balance, ~150 MB.
"""

import os
import tempfile
import time
from dataclasses import dataclass, field

WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "base")
WHISPER_CACHE = os.environ.get("WHISPER_CACHE", "/models/whisper")

_model = None


def _get_model():
    global _model
    if _model is None:
        import whisper
        _model = whisper.load_model(WHISPER_MODEL, download_root=WHISPER_CACHE)
    return _model


@dataclass
class TranscriptionResult:
    text: str = ""
    language: str = "unknown"
    language_probability: float = 0.0
    duration_seconds: float = 0.0
    processing_seconds: float = 0.0
    segments: list[dict] = field(default_factory=list)


def transcribe(audio_bytes: bytes, filename: str = "audio") -> TranscriptionResult:
    model = _get_model()
    result = TranscriptionResult()
    t0 = time.time()

    suffix = _guess_suffix(filename)
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        # openai-whisper returns a dict: {"text", "segments", "language"}
        output = model.transcribe(tmp_path, fp16=False)

        result.language = output.get("language", "unknown")
        result.text = output.get("text", "").strip()

        raw_segs = output.get("segments", [])
        result.segments = [
            {
                "start": round(s.get("start", 0), 2),
                "end":   round(s.get("end",   0), 2),
                "text":  s.get("text", "").strip(),
            }
            for s in raw_segs
        ]

        if raw_segs:
            last = raw_segs[-1]
            result.duration_seconds = round(last.get("end", 0), 2)

        # avg_logprob across segments as a proxy for confidence
        if raw_segs:
            avg_lp = sum(s.get("avg_logprob", -1.0) for s in raw_segs) / len(raw_segs)
            # logprob is negative; map to [0,1]: e^avg_lp, clipped
            import math
            result.language_probability = round(min(1.0, math.exp(avg_lp)), 3)

    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

    result.processing_seconds = round(time.time() - t0, 2)
    return result


def _guess_suffix(filename: str) -> str:
    name = filename.lower()
    for ext in (".mp3", ".wav", ".ogg", ".flac", ".m4a", ".mp4", ".webm"):
        if name.endswith(ext):
            return ext
    return ".audio"
