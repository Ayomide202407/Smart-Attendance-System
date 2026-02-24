from __future__ import annotations

from threading import Lock
from typing import List, Optional, Tuple

import os
import numpy as np

import cv2

from config import Config
from utils.embeddings import compute_embedding, crop_face_xyxy

_engine = None
_lock = Lock()


def _check_sface_available() -> bool:
    if not hasattr(cv2, "FaceDetectorYN") or not hasattr(cv2, "FaceRecognizerSF"):
        return False
    det_path = Config.OPENCV_DET_MODEL
    rec_path = Config.OPENCV_REC_MODEL
    if not os.path.isabs(det_path):
        det_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), det_path)
    if not os.path.isabs(rec_path):
        rec_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), rec_path)
    return os.path.exists(det_path) and os.path.exists(rec_path)


def _init_engine():
    det_path = Config.OPENCV_DET_MODEL
    rec_path = Config.OPENCV_REC_MODEL
    if not os.path.isabs(det_path):
        det_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), det_path)
    if not os.path.isabs(rec_path):
        rec_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), rec_path)

    detector = cv2.FaceDetectorYN.create(
        det_path,
        "",
        (Config.OPENCV_DET_SIZE, Config.OPENCV_DET_SIZE),
        Config.OPENCV_DET_THRESH,
        0.3,
        5000,
    )
    recognizer = cv2.FaceRecognizerSF.create(rec_path, "")
    return {"detector": detector, "recognizer": recognizer}


def get_engine():
    global _engine
    if not _check_sface_available():
        return None
    if _engine is not None:
        return _engine
    with _lock:
        if _engine is None:
            _engine = _init_engine()
    return _engine


def _face_area_xyxy(bbox) -> float:
    x1, y1, x2, y2 = bbox
    return float(max(0.0, x2 - x1) * max(0.0, y2 - y1))

def _iou_xyxy(a, b) -> float:
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1 = max(ax1, bx1)
    iy1 = max(ay1, by1)
    ix2 = min(ax2, bx2)
    iy2 = min(ay2, by2)
    iw = max(0.0, ix2 - ix1)
    ih = max(0.0, iy2 - iy1)
    inter = iw * ih
    if inter <= 0.0:
        return 0.0
    a_area = max(0.0, ax2 - ax1) * max(0.0, ay2 - ay1)
    b_area = max(0.0, bx2 - bx1) * max(0.0, by2 - by1)
    union = max(1e-8, a_area + b_area - inter)
    return float(inter / union)


def _nms_faces(faces, iou_thresh: float):
    if faces is None:
        return faces
    if len(faces) == 0:
        return faces

    arr = np.asarray(faces)
    if arr.ndim == 1:
        arr = arr.reshape(1, -1)

    boxes = []
    scores = []
    for f in arr:
        x, y, fw, fh = f[:4]
        boxes.append((float(x), float(y), float(x + fw), float(y + fh)))
        scores.append(float(f[4]) if len(f) > 4 else 1.0)

    idxs = np.argsort(scores)[::-1]
    keep = []
    while len(idxs) > 0:
        i = int(idxs[0])
        keep.append(i)
        if len(idxs) == 1:
            break
        rest = idxs[1:]
        kept = []
        for j in rest:
            if _iou_xyxy(boxes[i], boxes[int(j)]) <= iou_thresh:
                kept.append(int(j))
        idxs = np.asarray(kept, dtype=int)

    return arr[keep]


def extract_all_embeddings(image_bgr) -> List[Tuple[np.ndarray, Tuple[int, int, int, int], float]]:
    """
    Returns a list of (embedding, bbox_xyxy, det_score).
    bbox is (x1, y1, x2, y2) int.
    """
    engine = get_engine()
    if engine is None:
        # Fallback: Haar detector + simple embeddings
        gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
        detector = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )
        faces = detector.detectMultiScale(
            gray, scaleFactor=1.2, minNeighbors=5, minSize=(70, 70)
        )
        out = []
        if faces is None or len(faces) == 0:
            return out
        for (x, y, w, h) in faces:
            xyxy = (int(x), int(y), int(x + w), int(y + h))
            face = crop_face_xyxy(image_bgr, xyxy)
            emb = compute_embedding(face)
            out.append((emb.astype(np.float32), xyxy, 1.0))
        return out

    detector = engine["detector"]
    recognizer = engine["recognizer"]

    h, w = image_bgr.shape[:2]
    detector.setInputSize((w, h))

    _, faces = detector.detect(image_bgr)
    out = []
    if faces is None:
        return out
    faces = _nms_faces(faces, Config.OPENCV_NMS_THRESH)

    for f in faces:
        x, y, fw, fh = f[:4]
        score = float(f[4]) if len(f) > 4 else 1.0
        xyxy = (int(x), int(y), int(x + fw), int(y + fh))
        try:
            aligned = recognizer.alignCrop(image_bgr, f)
            emb = recognizer.feature(aligned)
            emb = emb.flatten().astype(np.float32)
            out.append((emb, xyxy, score))
        except Exception:
            continue
    return out


def extract_all_embeddings_with_landmarks(
    image_bgr,
) -> List[Tuple[np.ndarray, Tuple[int, int, int, int], float, Optional[List[Tuple[float, float]]]]]:
    """
    Returns a list of (embedding, bbox_xyxy, det_score, landmarks).
    landmarks: list of 5 (x,y) points or None if unavailable.
    """
    engine = get_engine()
    if engine is None:
        # Fallback: Haar detector + simple embeddings (no landmarks)
        gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
        detector = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )
        faces = detector.detectMultiScale(
            gray, scaleFactor=1.2, minNeighbors=5, minSize=(70, 70)
        )
        out = []
        if faces is None or len(faces) == 0:
            return out
        for (x, y, w, h) in faces:
            xyxy = (int(x), int(y), int(x + w), int(y + h))
            face = crop_face_xyxy(image_bgr, xyxy)
            emb = compute_embedding(face)
            out.append((emb.astype(np.float32), xyxy, 1.0, None))
        return out

    detector = engine["detector"]
    recognizer = engine["recognizer"]

    h, w = image_bgr.shape[:2]
    detector.setInputSize((w, h))

    _, faces = detector.detect(image_bgr)
    out = []
    if faces is None:
        return out
    faces = _nms_faces(faces, Config.OPENCV_NMS_THRESH)

    for f in faces:
        x, y, fw, fh = f[:4]
        score = float(f[4]) if len(f) > 4 else 1.0
        xyxy = (int(x), int(y), int(x + fw), int(y + fh))

        landmarks = None
        if len(f) >= 15:
            landmarks = [
                (float(f[5]), float(f[6])),   # left eye
                (float(f[7]), float(f[8])),   # right eye
                (float(f[9]), float(f[10])),  # nose
                (float(f[11]), float(f[12])), # left mouth
                (float(f[13]), float(f[14])), # right mouth
            ]

        try:
            aligned = recognizer.alignCrop(image_bgr, f)
            emb = recognizer.feature(aligned)
            emb = emb.flatten().astype(np.float32)
            out.append((emb, xyxy, score, landmarks))
        except Exception:
            continue
    return out


def extract_best_embedding(image_bgr) -> Optional[Tuple[np.ndarray, Tuple[int, int, int, int], float]]:
    """
    Returns (embedding, bbox_xyxy, det_score) for the best face.
    Best = highest det_score, then largest area.
    """
    faces = extract_all_embeddings(image_bgr)
    if not faces:
        return None
    return max(faces, key=lambda it: (it[2], _face_area_xyxy(it[1])))


def extract_best_embedding_with_landmarks(
    image_bgr,
) -> Optional[Tuple[np.ndarray, Tuple[int, int, int, int], float, Optional[List[Tuple[float, float]]]]]:
    """
    Returns (embedding, bbox_xyxy, det_score, landmarks) for the best face.
    Best = highest det_score, then largest area.
    """
    faces = extract_all_embeddings_with_landmarks(image_bgr)
    if not faces:
        return None
    return max(faces, key=lambda it: (it[2], _face_area_xyxy(it[1])))


def embedding_from_detection(image_bgr, det) -> Optional[np.ndarray]:
    """
    Compute an embedding from a YuNet detection row (with landmarks).
    Returns embedding vector or None.
    """
    engine = get_engine()
    if engine is None:
        return None
    recognizer = engine["recognizer"]
    try:
        aligned = recognizer.alignCrop(image_bgr, det)
        emb = recognizer.feature(aligned)
        return emb.flatten().astype(np.float32)
    except Exception:
        return None
