"""
Image analysis using OpenCV built-in Haarcascades + Pillow EXIF.
No external model downloads needed — haarcascades ship with opencv-python.
"""

import io
import os
from dataclasses import dataclass, field

import cv2
import numpy as np
from PIL import Image, ExifTags

CONFIDENCE = float(os.environ.get("DETECTION_CONFIDENCE", "0.4"))

# Haarcascades bundled with opencv-python — always available
_CASCADE_DIR = cv2.data.haarcascades
_cascades: dict[str, cv2.CascadeClassifier] | None = None


def _get_cascades() -> dict[str, cv2.CascadeClassifier]:
    global _cascades
    if _cascades is None:
        _cascades = {}
        specs = {
            "face":       "haarcascade_frontalface_default.xml",
            "face_alt":   "haarcascade_frontalface_alt2.xml",
            "eye":        "haarcascade_eye.xml",
            "upper_body": "haarcascade_upperbody.xml",
            "full_body":  "haarcascade_fullbody.xml",
            "plate":      "haarcascade_russian_plate_number.xml",
        }
        for name, fname in specs.items():
            path = os.path.join(_CASCADE_DIR, fname)
            if os.path.exists(path):
                cc = cv2.CascadeClassifier(path)
                if not cc.empty():
                    _cascades[name] = cc
    return _cascades


@dataclass
class ImageAnalysisResult:
    width:        int  = 0
    height:       int  = 0
    channels:     int  = 0
    format:       str  = "unknown"
    detections:   list[dict] = field(default_factory=list)
    face_count:   int  = 0
    person_count: int  = 0
    plate_count:  int  = 0
    exif:         dict = field(default_factory=dict)
    colors:       list[dict] = field(default_factory=list)
    severity:     str  = "low"


def analyze(data: bytes) -> ImageAnalysisResult:
    result = ImageAnalysisResult()

    # ── Basic metadata via Pillow ─────────────────────────────────────────────
    try:
        pil_img = Image.open(io.BytesIO(data))
        result.format         = pil_img.format or "unknown"
        result.width, result.height = pil_img.size
        raw_exif = pil_img._getexif() if hasattr(pil_img, "_getexif") else None
        if raw_exif:
            result.exif = {
                ExifTags.TAGS.get(k, str(k)): str(v)
                for k, v in raw_exif.items()
                if k in ExifTags.TAGS and isinstance(v, (str, int, float, bytes))
            }
    except Exception:
        pass

    # ── OpenCV processing ─────────────────────────────────────────────────────
    img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        return result

    result.channels = img.shape[2] if len(img.shape) == 3 else 1
    result.height, result.width = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # ── Dominant color analysis ───────────────────────────────────────────────
    try:
        small   = cv2.resize(img, (64, 64))
        pixels  = small.reshape(-1, 3).astype(np.float32)
        k       = min(5, len(pixels))
        _, labels, centers = cv2.kmeans(
            pixels, k, None,
            (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0),
            3, cv2.KMEANS_RANDOM_CENTERS,
        )
        counts  = np.bincount(labels.flatten())
        total   = counts.sum()
        result.colors = [
            {
                "rgb":    [int(c[2]), int(c[1]), int(c[0])],
                "pct":    round(float(counts[i]) / total * 100, 1),
            }
            for i, c in sorted(enumerate(centers), key=lambda x: -counts[x[0]])
        ]
    except Exception:
        pass

    # ── Object detection via Haarcascades ─────────────────────────────────────
    cascades = _get_cascades()

    def _detect(name: str, scale: float = 1.1, neighbors: int = 3) -> list[list[int]]:
        if name not in cascades:
            return []
        hits = cascades[name].detectMultiScale(gray, scale, neighbors, minSize=(30, 30))
        if len(hits) == 0:
            return []
        return hits.tolist()

    # Faces (combine two cascades, deduplicate)
    faces      = _detect("face",     1.1, 4)
    faces_alt  = _detect("face_alt", 1.05, 3)
    all_faces  = _merge_boxes(faces + faces_alt)
    result.face_count = len(all_faces)
    for x, y, w, h in all_faces:
        result.detections.append({
            "type": "face", "bbox": [x, y, w, h],
        })

    # Bodies
    bodies = _detect("full_body", 1.05, 2)
    upper  = _detect("upper_body", 1.05, 2)
    all_bodies = _merge_boxes(bodies + upper)
    result.person_count = max(result.face_count, len(all_bodies))
    for x, y, w, h in all_bodies:
        result.detections.append({
            "type": "person", "bbox": [x, y, w, h],
        })

    # License plates
    plates = _detect("plate", 1.1, 3)
    result.plate_count = len(plates)
    for x, y, w, h in plates:
        result.detections.append({
            "type": "license_plate", "bbox": [x, y, w, h],
        })

    # ── Severity ──────────────────────────────────────────────────────────────
    if result.face_count >= 3 or result.person_count >= 3:
        result.severity = "medium"
    if result.face_count >= 8 or result.person_count >= 8:
        result.severity = "high"
    if result.plate_count > 0:
        result.severity = max(result.severity, "medium",
                              key=lambda s: ["low","medium","high","critical"].index(s))

    return result


def _merge_boxes(boxes: list, iou_thresh: float = 0.4) -> list[list[int]]:
    """Merge overlapping bounding boxes (simple NMS)."""
    if not boxes:
        return []
    picked = []
    boxes_sorted = sorted(boxes, key=lambda b: b[2] * b[3], reverse=True)
    for box in boxes_sorted:
        x1, y1, w1, h1 = box
        keep = True
        for p in picked:
            x2, y2, w2, h2 = p
            ix = max(0, min(x1+w1, x2+w2) - max(x1, x2))
            iy = max(0, min(y1+h1, y2+h2) - max(y1, y2))
            inter = ix * iy
            union = w1*h1 + w2*h2 - inter
            if union > 0 and inter / union > iou_thresh:
                keep = False
                break
        if keep:
            picked.append(box)
    return picked
