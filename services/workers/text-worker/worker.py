import sys
sys.path.insert(0, "/app")

from base.consumer import BaseWorker
import analyzer


class TextWorker(BaseWorker):
    def __init__(self):
        super().__init__(queue_name="tasks.text_analysis", task_type="text_analysis")
        # Warm up spaCy model on startup
        self.logger.info("Loading spaCy model...")
        analyzer._get_nlp()
        self.logger.info("spaCy model loaded")

    def process(self, task: dict, file_bytes: bytes):
        # Decode text — try UTF-8 then latin-1 as fallback
        try:
            text = file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            text = file_bytes.decode("latin-1", errors="replace")

        result = analyzer.analyze(text)

        # ── Finding: keyword summary ──────────────────────────────────────────
        if result.keywords:
            self.save_finding(
                task,
                finding_type="keywords",
                title=f"Top keywords detected ({len(result.keywords)})",
                description=", ".join(result.keywords[:20]),
                severity="low",
                data={"keywords": result.keywords, "word_count": result.word_count},
            )

        # ── Findings: significant entities ────────────────────────────────────
        entity_groups: dict[str, list[str]] = {}
        for ent in result.entities:
            entity_groups.setdefault(ent["label"], []).append(ent["text"])

        for label, texts in entity_groups.items():
            if label in ("PERSON", "ORG", "GPE", "FAC", "LOC", "MONEY", "PRODUCT"):
                self.save_finding(
                    task,
                    finding_type="entity",
                    title=f"{label}: {', '.join(texts[:5])}",
                    description=f"Detected {len(texts)} entity/entities of type {label}",
                    severity="low",
                    data={"entity_type": label, "entities": texts},
                )

        # ── Findings: risk matches per category ───────────────────────────────
        for category, count in result.categories.items():
            hits = [m for m in result.risk_matches if m["category"] == category]
            worst_sev = max(hits, key=lambda m: {"low":0,"medium":1,"high":2,"critical":3}[m["severity"]])["severity"]
            keywords_found = list({m["keyword"] for m in hits})

            self.save_finding(
                task,
                finding_type="risk",
                title=f"Risk detected: {category.replace('_',' ').title()} ({count} match{'es' if count>1 else ''})",
                description=f"Risk keywords found: {', '.join(keywords_found)}",
                severity=worst_sev,
                data={
                    "category": category,
                    "keywords": keywords_found,
                    "total_matches": count,
                    "details": hits,
                },
            )

        self.logger.info(
            f"Text analysis complete — words={result.word_count} "
            f"entities={len(result.entities)} risks={len(result.risk_matches)} "
            f"severity={result.overall_severity}"
        )


if __name__ == "__main__":
    TextWorker().run()
