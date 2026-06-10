import sys
sys.path.insert(0, "/app")

from base.consumer import BaseWorker
from base import db as base_db
import extractor

# Import text analyzer to run inline (no secondary task queue hop needed)
sys.path.insert(0, "/app/text-worker-lib")
try:
    import analyzer as text_analyzer
    HAS_TEXT_ANALYSIS = True
except ImportError:
    HAS_TEXT_ANALYSIS = False


class DocumentWorker(BaseWorker):
    def __init__(self):
        super().__init__(queue_name="tasks.document_analysis", task_type="document_analysis")
        if HAS_TEXT_ANALYSIS:
            self.logger.info("Loading spaCy model for inline text analysis...")
            text_analyzer._get_nlp()

    def process(self, task: dict, file_bytes: bytes):
        mime     = task.get("mime_type", "")
        filename = task.get("original_filename", "")

        # ── Extract text (HU-17) ──────────────────────────────────────────────
        try:
            text, meta = extractor.extract(file_bytes, mime, filename)
        except Exception as exc:
            raise RuntimeError(f"Text extraction failed: {exc}") from exc

        if not text.strip():
            self.save_finding(
                task,
                finding_type="extraction_warning",
                title="Document contains no extractable text",
                description="The document may be image-based (scanned). OCR is required.",
                severity="low",
                data={"filename": filename, "mime_type": mime},
            )
            return

        # ── Upload extracted text as artifact ─────────────────────────────────
        artifact_path = self.upload_artifact(
            str(task["evidence_id"]),
            "extracted_text.txt",
            text.encode("utf-8"),
            "text/plain",
        )
        self.logger.info(f"Extracted {meta.get('word_count',0)} words → {artifact_path}")

        # ── Finding: extraction summary ───────────────────────────────────────
        self.save_finding(
            task,
            finding_type="extraction",
            title=f"Text extracted: {meta.get('word_count', 0)} words",
            description=f"Successfully extracted text from {filename}",
            severity="low",
            data={**meta, "artifact_path": artifact_path, "filename": filename},
        )

        # ── Inline text analysis (secondary task HU-17) ───────────────────────
        if HAS_TEXT_ANALYSIS and text.strip():
            self._run_text_analysis(task, text)

        # ── Register secondary task in DB ─────────────────────────────────────
        base_db.create_secondary_task(
            self.db_conn,
            case_id=task["case_id"],
            evidence_id=str(task["evidence_id"]),
            task_type="text_analysis",
            queue_name="tasks.text_analysis",
            priority=task["priority"],
        )

    def _run_text_analysis(self, task: dict, text: str):
        """Run text analysis inline on the extracted document text."""
        result = text_analyzer.analyze(text)

        if result.keywords:
            self.save_finding(
                task,
                finding_type="keywords",
                title=f"Document keywords ({len(result.keywords)})",
                description=", ".join(result.keywords[:20]),
                severity="low",
                data={"keywords": result.keywords, "word_count": result.word_count},
            )

        for category, count in result.categories.items():
            hits     = [m for m in result.risk_matches if m["category"] == category]
            sev_map  = {"low": 0, "medium": 1, "high": 2, "critical": 3}
            worst    = max(hits, key=lambda m: sev_map[m["severity"]])["severity"]
            kw_found = list({m["keyword"] for m in hits})
            self.save_finding(
                task,
                finding_type="risk",
                title=f"Risk in document: {category.replace('_',' ').title()} ({count} match{'es' if count>1 else ''})",
                description=f"Risk keywords: {', '.join(kw_found)}",
                severity=worst,
                data={"category": category, "keywords": kw_found, "details": hits},
            )


if __name__ == "__main__":
    DocumentWorker().run()
