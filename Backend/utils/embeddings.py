import os
import time
from typing import Optional, Tuple

import cv2
import numpy as np


# -----------------------------
# Paths
# -----------------------------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FACES_DIR = os.path.join(BASE_DIR, "dataset", "faces")
EMB_DIR = os.path.join(BASE_DIR, "embeddings", "students")


def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


# -----------------------------
# Face detection (Haar)
# -----------------------------
def crop_face(image_bgr, box, pad: int = 12):
    x, y, w, h = box
    h_img, w_img = image_bgr.shape[:2]

    x1 = max(0, x - pad)
    y1 = max(0, y - pad)
    x2 = min(w_img, x + w + pad)
    y2 = min(h_img, y + h + pad)

    return image_bgr[y1:y2, x1:x2]


def crop_face_xyxy(image_bgr, box_xyxy, pad: int = 12):
    x1, y1, x2, y2 = box_xyxy
    h_img, w_img = image_bgr.shape[:2]

    x1 = max(0, int(x1) - pad)
    y1 = max(0, int(y1) - pad)
    x2 = min(w_img, int(x2) + pad)
    y2 = min(h_img, int(y2) + pad)

    return image_bgr[y1:y2, x1:x2]


def blur_score(image_bgr) -> float:
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


# -----------------------------
# Embedding (simple, works now)
# -----------------------------
def compute_embedding(face_bgr, size: int = 64) -> np.ndarray:
    """
    Deprecated fallback embedding (used only if InsightFace is unavailable).
    """
    gray = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2GRAY)
    resized = cv2.resize(gray, (size, size), interpolation=cv2.INTER_AREA)
    vec = resized.astype(np.float32).reshape(-1)
    norm = np.linalg.norm(vec) + 1e-8
    return vec / norm


def student_face_dir(student_id: str) -> str:
    path = os.path.join(FACES_DIR, student_id)
    ensure_dir(path)
    return path


def student_emb_dir(student_id: str) -> str:
    path = os.path.join(EMB_DIR, student_id)
    ensure_dir(path)
    return path


def save_face_and_embedding(
    student_id: str,
    view_type: str,
    face_bgr,
    embedding: np.ndarray,
    model_name: str = "insightface",
    max_samples: int = 8,
):
    """
    Saves:
    - cropped face image: dataset/faces/<student_id>/<view_type>_<ts>.jpg
    - embeddings file: embeddings/students/<student_id>/<view_type>.npy

    IMPORTANT (Batch 11):
    - <view_type>.npy now stores MANY embeddings:
      shape = (K, D)
      so we can recognize better in different lighting/angles.
    - We keep ONLY the latest `max_samples`.
    """

    ts = int(time.time() * 1000)

    face_path = os.path.join(student_face_dir(student_id), f"{view_type}_{ts}.jpg")
    cv2.imwrite(face_path, face_bgr)

    emb = embedding.astype(np.float32)  # shape (D,)
    emb_path = os.path.join(student_emb_dir(student_id), f"{view_type}.npy")

    if os.path.exists(emb_path):
        try:
            old = np.load(emb_path)
            # old can be (D,) or (K,D)
            if old.ndim == 1:
                old = old.reshape(1, -1)
            new = np.vstack([old, emb.reshape(1, -1)])
            # keep last max_samples
            if new.shape[0] > max_samples:
                new = new[-max_samples:, :]
            np.save(emb_path, new)
        except Exception:
            # if file corrupt, overwrite
            np.save(emb_path, emb.reshape(1, -1))
    else:
        np.save(emb_path, emb.reshape(1, -1))

    return face_path, emb_path, model_name, emb


def delete_student_face_data(student_id: str) -> dict:
    """
    Remove all stored face images and embeddings for a student.
    Returns counts for files removed (best effort).
    """
    import shutil

    emb_dir = os.path.join(EMB_DIR, student_id)
    face_dir = os.path.join(FACES_DIR, student_id)

    emb_files = 0
    face_files = 0

    if os.path.exists(emb_dir):
        for _, _, files in os.walk(emb_dir):
            emb_files += len(files)
        shutil.rmtree(emb_dir, ignore_errors=True)

    if os.path.exists(face_dir):
        for _, _, files in os.walk(face_dir):
            face_files += len(files)
        shutil.rmtree(face_dir, ignore_errors=True)

    return {
        "embeddings_deleted": int(emb_files),
        "faces_deleted": int(face_files),
    }
