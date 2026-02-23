from __future__ import annotations

from typing import Dict, List, Optional, Tuple

import numpy as np

from config import Config
from utils.embeddings import blur_score, crop_face_xyxy


def _dist(a: Tuple[float, float], b: Tuple[float, float]) -> float:
    ax, ay = a
    bx, by = b
    return float(((ax - bx) ** 2 + (ay - by) ** 2) ** 0.5)


def evaluate_liveness(
    image_bgr,
    bbox_xyxy: Tuple[int, int, int, int],
    landmarks: Optional[List[Tuple[float, float]]],
) -> Dict[str, object]:
    """
    Heuristic liveness check using face size, eye distance, and blur.
    Returns:
    {
      "checked": bool,
      "score": float,
      "pass": bool,
      "details": { ... }
    }
    """
    if landmarks is None or len(landmarks) < 2:
        return {"checked": False, "score": 0.0, "pass": False, "details": {"reason": "no_landmarks"}}

    x1, y1, x2, y2 = bbox_xyxy
    h_img, w_img = image_bgr.shape[:2]
    face_area = max(0, x2 - x1) * max(0, y2 - y1)
    img_area = max(1, w_img * h_img)
    face_ratio = face_area / img_area

    left_eye = landmarks[0]
    right_eye = landmarks[1]
    eye_dist = _dist(left_eye, right_eye)
    bbox_w = max(1, x2 - x1)
    eye_ratio = eye_dist / bbox_w

    face = crop_face_xyxy(image_bgr, bbox_xyxy)
    blur = blur_score(face)

    face_ratio_score = min(1.0, face_ratio / max(1e-6, Config.LIVENESS_MIN_FACE_RATIO))
    eye_ratio_score = min(1.0, eye_ratio / max(1e-6, Config.LIVENESS_MIN_EYE_DIST_RATIO))
    blur_score_norm = min(1.0, blur / max(1e-6, Config.BLUR_THRESHOLD))

    score = float((face_ratio_score + eye_ratio_score + blur_score_norm) / 3.0)
    passed = score >= Config.LIVENESS_MIN_SCORE

    return {
        "checked": True,
        "score": score,
        "pass": passed,
        "details": {
            "face_ratio": face_ratio,
            "eye_ratio": eye_ratio,
            "blur_score": blur,
        },
    }


def _nose_ratio(
    bbox_xyxy: Tuple[int, int, int, int],
    landmarks: Optional[List[Tuple[float, float]]],
) -> Optional[float]:
    if not landmarks or len(landmarks) < 3:
        return None
    x1, y1, x2, y2 = bbox_xyxy
    nose_x, _ = landmarks[2]
    w = max(1.0, float(x2 - x1))
    return float((nose_x - x1) / w)


def evaluate_liveness_challenge(
    frames: List[Tuple[Tuple[int, int, int, int], Optional[List[Tuple[float, float]]]]],
    challenge: str,
) -> Dict[str, object]:
    """
    Multi-frame challenge using landmark nose position:
    - challenge: "turn_left", "turn_right", "left_right"
    """
    if not frames:
        return {"ok": False, "pass": False, "reason": "no_frames"}

    ratios = []
    for bbox, landmarks in frames:
        ratio = _nose_ratio(bbox, landmarks)
        if ratio is None:
            continue
        ratios.append(ratio)

    if len(ratios) < 2:
        return {"ok": False, "pass": False, "reason": "no_landmarks"}

    left = any(r <= 0.5 - Config.LIVENESS_CHALLENGE_SHIFT for r in ratios)
    right = any(r >= 0.5 + Config.LIVENESS_CHALLENGE_SHIFT for r in ratios)
    center = any(abs(r - 0.5) <= Config.LIVENESS_CHALLENGE_SHIFT for r in ratios)

    if challenge == "turn_left":
        passed = left and center
    elif challenge == "turn_right":
        passed = right and center
    elif challenge == "left_right":
        passed = left and right and center
    else:
        return {"ok": False, "pass": False, "reason": "invalid_challenge"}

    return {
        "ok": True,
        "pass": bool(passed),
        "challenge": challenge,
        "ratios": ratios,
        "details": {"left": left, "right": right, "center": center},
    }
