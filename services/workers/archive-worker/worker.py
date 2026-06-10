import io
import sys
import tarfile
import zipfile
sys.path.insert(0, "/app")

from base.consumer import BaseWorker


RISK_EXTENSIONS = {
    ".exe", ".dll", ".bat", ".cmd", ".ps1", ".sh", ".vbs", ".js",
    ".py", ".rb", ".pl", ".php", ".jar", ".class",
}

SENSITIVE_PATTERNS = ["password", "passwd", "secret", "credentials", "private", "key", "token"]


def _check_filename(name: str) -> tuple[str, str]:
    """Return (severity, reason) for a filename."""
    lower = name.lower()
    ext   = "." + lower.rsplit(".", 1)[-1] if "." in lower else ""
    if ext in RISK_EXTENSIONS:
        return "high", f"Executable/script file: {name}"
    for pat in SENSITIVE_PATTERNS:
        if pat in lower:
            return "medium", f"Potentially sensitive filename: {name}"
    return "low", ""


class ArchiveWorker(BaseWorker):
    def __init__(self):
        super().__init__(queue_name="tasks.archive_analysis", task_type="archive_analysis")

    def process(self, task: dict, file_bytes: bytes):
        filename = (task.get("original_filename") or "archive").lower()
        entries  = self._list_entries(file_bytes, filename)

        if not entries:
            self.save_finding(
                task,
                finding_type="archive_empty",
                title="Archive is empty or could not be read",
                severity="low",
                data={"filename": filename},
            )
            return

        # ── Finding: contents summary ─────────────────────────────────────────
        ext_counts: dict[str, int] = {}
        risk_files: list[dict]     = []
        overall_sev = "low"

        for entry in entries:
            ext = "." + entry["name"].rsplit(".", 1)[-1].lower() if "." in entry["name"] else ""
            ext_counts[ext] = ext_counts.get(ext, 0) + 1

            sev, reason = _check_filename(entry["name"])
            if sev != "low":
                risk_files.append({"name": entry["name"], "severity": sev, "reason": reason})
                if sev == "high":
                    overall_sev = "high"
                elif sev == "medium" and overall_sev == "low":
                    overall_sev = "medium"

        self.save_finding(
            task,
            finding_type="archive_contents",
            title=f"Archive contains {len(entries)} file(s)",
            description="Extensions: " + ", ".join(
                f"{v}× {k or 'no-ext'}"
                for k, v in sorted(ext_counts.items(), key=lambda x: -x[1])[:10]
            ),
            severity="low",
            data={"total_files": len(entries), "extension_counts": ext_counts,
                  "entries": [e["name"] for e in entries[:200]]},
        )

        # ── Finding: risky files ───────────────────────────────────────────────
        if risk_files:
            self.save_finding(
                task,
                finding_type="archive_risk",
                title=f"{len(risk_files)} potentially risky file(s) found",
                description="; ".join(f["reason"] for f in risk_files[:5]),
                severity=overall_sev,
                data={"risk_files": risk_files},
            )

        self.logger.info(f"Archive processed — {len(entries)} entries, {len(risk_files)} risk files")

    def _list_entries(self, data: bytes, filename: str) -> list[dict]:
        # ZIP
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as zf:
                return [{"name": info.filename, "size": info.file_size} for info in zf.infolist()]
        except zipfile.BadZipFile:
            pass

        # TAR (handles .tar, .tar.gz, .tar.bz2, .tgz)
        try:
            with tarfile.open(fileobj=io.BytesIO(data)) as tf:
                return [{"name": m.name, "size": m.size} for m in tf.getmembers() if m.isfile()]
        except tarfile.TarError:
            pass

        # 7-Zip
        try:
            import py7zr
            with py7zr.SevenZipFile(io.BytesIO(data)) as sz:
                return [{"name": info.filename, "size": info.uncompressed or 0}
                        for info in sz.list()]
        except Exception:
            pass

        return []


if __name__ == "__main__":
    ArchiveWorker().run()
