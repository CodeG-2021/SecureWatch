import sys
sys.path.insert(0, "/app")

from base.consumer import BaseWorker
from base import db as base_db
import transcriber

sys.path.insert(0, "/app/text-worker-lib")
try:
    import analyzer as text_analyzer
    HAS_TEXT_ANALYSIS = True
except ImportError:
    HAS_TEXT_ANALYSIS = False


class AudioWorker(BaseWorker):
    def __init__(self):
        super().__init__(queue_name="tasks.audio_analysis", task_type="audio_analysis")
        self.logger.info("Loading Whisper model (this may take a moment)...")
        transcriber._get_model()
        self.logger.info("Whisper model loaded")
        if HAS_TEXT_ANALYSIS:
            text_analyzer._get_nlp()

    def process(self, task: dict, file_bytes: bytes):
        filename = task.get("original_filename", "audio")

        # ── Transcribe (HU-19) ────────────────────────────────────────────────
        result = transcriber.transcribe(file_bytes, filename)

        if not result.text.strip():
            self.save_finding(
                task,
                finding_type="transcription_warning",
                title="Audio transcription produced no text",
                description="The audio may be silent, too noisy, or in an unsupported format.",
                severity="low",
                data={"duration_seconds": result.duration_seconds,
                      "language": result.language},
            )
            return

        # ── Upload transcript as artifact ─────────────────────────────────────
        artifact_path = self.upload_artifact(
            str(task["evidence_id"]),
            "transcript.txt",
            result.text.encode("utf-8"),
            "text/plain",
        )

        # ── Finding: transcription ────────────────────────────────────────────
        self.save_finding(
            task,
            finding_type="transcription",
            title=f"Transcription ({result.language.upper()}, {result.duration_seconds}s)",
            description=result.text[:500] + ("…" if len(result.text) > 500 else ""),
            severity="low",
            data={
                "language":              result.language,
                "language_probability":  result.language_probability,
                "duration_seconds":      result.duration_seconds,
                "processing_seconds":    result.processing_seconds,
                "word_count":            len(result.text.split()),
                "artifact_path":         artifact_path,
                "segments":              result.segments[:100],
            },
        )

        # ── Inline text analysis on transcript ────────────────────────────────
        if HAS_TEXT_ANALYSIS:
            ta = text_analyzer.analyze(result.text)
            for category, count in ta.categories.items():
                hits  = [m for m in ta.risk_matches if m["category"] == category]
                smap  = {"low":0,"medium":1,"high":2,"critical":3}
                worst = max(hits, key=lambda m: smap[m["severity"]])["severity"]
                kw    = list({m["keyword"] for m in hits})
                self.save_finding(
                    task,
                    finding_type="risk",
                    title=f"Risk in transcript: {category.replace('_',' ').title()}",
                    description=f"Keywords: {', '.join(kw)}",
                    severity=worst,
                    data={"category": category, "keywords": kw, "details": hits},
                )

        # ── Register secondary text_analysis task ─────────────────────────────
        base_db.create_secondary_task(
            self.db_conn,
            case_id=task["case_id"],
            evidence_id=str(task["evidence_id"]),
            task_type="text_analysis",
            queue_name="tasks.text_analysis",
            priority=task["priority"],
        )

        self.logger.info(
            f"Audio processed — lang={result.language} "
            f"duration={result.duration_seconds}s "
            f"words={len(result.text.split())} "
            f"processing={result.processing_seconds}s"
        )


if __name__ == "__main__":
    AudioWorker().run()
