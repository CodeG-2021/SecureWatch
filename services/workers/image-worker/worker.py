import sys
sys.path.insert(0, "/app")

from base.consumer import BaseWorker
import analyzer


class ImageWorker(BaseWorker):
    def __init__(self):
        super().__init__(queue_name="tasks.image_analysis", task_type="image_analysis")
        self.logger.info("Loading OpenCV haarcascades...")
        analyzer._get_cascades()
        self.logger.info("Haarcascades loaded")

    def process(self, task: dict, file_bytes: bytes):
        result = analyzer.analyze(file_bytes)

        # ── Finding: image metadata ───────────────────────────────────────────
        self.save_finding(
            task,
            finding_type="image_metadata",
            title=f"Image: {result.width}×{result.height} {result.format}",
            description=f"{result.channels}-channel image · {result.width * result.height:,} pixels",
            severity="low",
            data={
                "width":    result.width,
                "height":   result.height,
                "channels": result.channels,
                "format":   result.format,
                "colors":   result.colors,
            },
        )

        # ── Finding: EXIF data ────────────────────────────────────────────────
        if result.exif:
            interesting = {k: v for k, v in result.exif.items()
                           if k in ("DateTime", "GPSInfo", "Make", "Model",
                                    "Software", "Artist", "Copyright", "ImageDescription")}
            if interesting:
                self.save_finding(
                    task,
                    finding_type="exif_metadata",
                    title=f"EXIF metadata ({len(interesting)} fields)",
                    description="; ".join(f"{k}={v}" for k, v in list(interesting.items())[:5]),
                    severity="low",
                    data={"exif": interesting},
                )

        # ── Finding: face / person detection ─────────────────────────────────
        if result.face_count > 0 or result.person_count > 0:
            parts = []
            if result.face_count:
                parts.append(f"{result.face_count} face(s)")
            if result.person_count > result.face_count:
                parts.append(f"{result.person_count} person(s)")
            if result.plate_count:
                parts.append(f"{result.plate_count} license plate(s)")

            self.save_finding(
                task,
                finding_type="image_objects",
                title=f"Detected: {', '.join(parts)}",
                description=f"OpenCV haarcascade detection in {result.width}×{result.height} image",
                severity=result.severity,
                data={
                    "face_count":   result.face_count,
                    "person_count": result.person_count,
                    "plate_count":  result.plate_count,
                    "detections":   result.detections[:50],
                },
            )

        self.logger.info(
            f"Image analysis complete — {result.width}×{result.height} "
            f"faces={result.face_count} persons={result.person_count} "
            f"plates={result.plate_count}"
        )


if __name__ == "__main__":
    ImageWorker().run()
