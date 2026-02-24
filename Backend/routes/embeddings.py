import os

import cv2
import numpy as np
from flask import Blueprint, request
from sqlalchemy.exc import IntegrityError

from database.engine import SessionLocal
from database.models import User, FaceEmbedding
from utils.embeddings import crop_face_xyxy, blur_score, save_face_and_embedding
from utils.face_engine import extract_best_embedding_with_landmarks
from utils.liveness import evaluate_liveness, evaluate_liveness_challenge
from config import Config

bp = Blueprint("embeddings", __name__, url_prefix="/embeddings")


def _json_error(message: str, status_code: int = 400):
    return {"ok": False, "error": message}, status_code

def _has_completed_face_setup(db, student_id: str) -> bool:
    rows = db.query(FaceEmbedding).filter(FaceEmbedding.student_id == student_id).all()
    views = {r.view_type for r in rows}
    return {"front", "left", "right"}.issubset(views)

def _get_student_views(db, student_id: str):
    """Return set of view_type already saved for student."""
    rows = db.query(FaceEmbedding).filter(FaceEmbedding.student_id == student_id).all()
    return {r.view_type for r in rows}


@bp.post("/add")
def add_embedding():
    """
    Add a student's face embedding (ONE-TIME SETUP).

    POST /embeddings/add
    Content-Type: multipart/form-data

    Form fields:
    - student_id: UUID of student
    - view_type: front|left|right (default: front)
    - image: file upload (jpg/png)
    - blur_threshold (optional): float (default 120)

    IMPORTANT RULE:
    - Student can upload each view ONLY ONCE.
    - After front+left+right are uploaded, no more uploads are allowed forever.
    """
    student_id = (request.form.get("student_id") or "").strip()
    view_type = (request.form.get("view_type") or "front").strip().lower()
    blur_threshold = float(request.form.get("blur_threshold") or Config.BLUR_THRESHOLD)

    if not student_id:
        return _json_error("Missing form field: student_id", 400)
    if view_type not in ("front", "left", "right"):
        return _json_error("view_type must be front|left|right", 400)

    if "image" not in request.files:
        return _json_error("Missing file field: image", 400)

    file = request.files["image"]
    if file.filename.strip() == "":
        return _json_error("Empty filename for image", 400)

    # Read image bytes -> OpenCV BGR
    data = file.read()
    np_img = np.frombuffer(data, np.uint8)
    image = cv2.imdecode(np_img, cv2.IMREAD_COLOR)
    if image is None:
        return _json_error("Invalid image upload", 400)

    db = SessionLocal()
    try:
        student = db.query(User).filter(User.id == student_id).first()
        if not student:
            return _json_error("Student not found", 404)
        if student.role != "student":
            return _json_error("Only students can have embeddings", 400)

        # ✅ ENFORCE "FOREVER" RULE
        views = _get_student_views(db, student.id)

        # if completed already => block ALL
        if {"front", "left", "right"}.issubset(views):
            return _json_error(
                "Face setup already completed. You cannot change it.",
                403,
            )

        # if this specific view already exists => block replacing
        if view_type in views:
            return _json_error(
                f"{view_type} image already registered. You cannot replace it.",
                403,
            )

        # Detect + crop (InsightFace)
        best = extract_best_embedding_with_landmarks(image)
        if not best:
            return _json_error("No face detected in image", 400)

        embedding, bbox, _det_score, landmarks = best
        face = crop_face_xyxy(image, bbox)

        # Quality check
        score = blur_score(face)
        if score < blur_threshold:
            return _json_error(
                f"Image too blurry (score={score:.2f} < threshold={blur_threshold}). Retake photo.",
                400,
            )

        liveness = {"checked": False, "score": 0.0, "pass": False}
        if Config.LIVENESS_ENABLED:
            liveness = evaluate_liveness(image, bbox, landmarks)
            if not liveness.get("checked") and Config.LIVENESS_REQUIRED:
                return _json_error("Liveness check unavailable. Retake photo with better lighting.", 400)
            if liveness.get("checked") and not liveness.get("pass"):
                return _json_error("Liveness check failed. Retake photo.", 400)

        # Save embedding + face
        face_path, emb_path, model_name, emb = save_face_and_embedding(
            student_id=student.id,
            view_type=view_type,
            face_bgr=face,
            embedding=embedding,
            model_name="insightface",
        )

        # ✅ Insert ONLY (no update)
        row = FaceEmbedding(
            student_id=student.id,
            view_type=view_type,
            embedding_path=emb_path,
            model_name=model_name,
        )
        db.add(row)
        db.commit()
        db.refresh(row)

        # recompute status
        new_views = _get_student_views(db, student.id)
        completed = {"front", "left", "right"}.issubset(new_views)

        return {
            "ok": True,
            "created": True,
            "student_id": student.id,
            "view_type": view_type,
            "blur_score": score,
            "liveness_checked": bool(liveness.get("checked")) if Config.LIVENESS_ENABLED else False,
            "liveness_score": float(liveness.get("score", 0.0)) if Config.LIVENESS_ENABLED else 0.0,
            "liveness_pass": bool(liveness.get("pass", False)) if Config.LIVENESS_ENABLED else False,
            "embedding_dim": int(emb.shape[0]),
            "embedding_path": emb_path,
            "face_saved": True,
            "completed": completed,
            "missing_views": sorted(list({"front", "left", "right"} - new_views)),
        }, 200

    except IntegrityError:
        db.rollback()
        # unique constraint hit (student_id + view_type)
        return _json_error("This view was already registered. You cannot replace it.", 409)
    except Exception as e:
        db.rollback()
        return _json_error(f"Add embedding failed: {str(e)}", 500)
    finally:
        db.close()


@bp.get("/list/<student_id>")
def list_embeddings(student_id: str):
    """
    GET /embeddings/list/<student_id>
    Returns embeddings saved for the student.
    """
    db = SessionLocal()
    try:
        student = db.query(User).filter(User.id == student_id).first()
        if not student:
            return _json_error("Student not found", 404)

        rows = db.query(FaceEmbedding).filter(FaceEmbedding.student_id == student.id).all()
        out = []
        for r in rows:
            out.append({
                "id": r.id,
                "student_id": r.student_id,
                "view_type": r.view_type,
                "embedding_path": r.embedding_path,
                "model_name": r.model_name,
                "created_at": r.created_at.isoformat(),
                "file_exists": os.path.exists(r.embedding_path),
            })

        views = {r.view_type for r in rows}
        completed = {"front", "left", "right"}.issubset(views)

        return {
            "ok": True,
            "count": len(out),
            "embeddings": out,
            "completed": completed,
            "missing_views": sorted(list({"front", "left", "right"} - views)),
        }, 200
    finally:
        db.close()




@bp.post("/liveness-challenge")
def liveness_challenge():
    """
    Multi-frame liveness challenge (head turn).

    POST /embeddings/liveness-challenge (multipart/form-data)
    Fields:
    - challenge: "turn_left" | "turn_right" | "left_right"
    - frames: multiple image files (2-5)
    """
    challenge = (request.form.get("challenge") or "left_right").strip().lower()
    files = request.files.getlist("frames")
    if not files or len(files) < 2:
        return _json_error("Provide at least 2 frames", 400)

    frames = []
    for file in files:
        data = file.read()
        np_img = np.frombuffer(data, np.uint8)
        image = cv2.imdecode(np_img, cv2.IMREAD_COLOR)
        if image is None:
            continue
        best = extract_best_embedding_with_landmarks(image)
        if not best:
            continue
        _emb, bbox, _det, landmarks = best
        frames.append((bbox, landmarks))

    result = evaluate_liveness_challenge(frames, challenge)
    if not result.get("ok"):
        return _json_error(result.get("reason", "Liveness challenge failed"), 400)

    return {"ok": True, "pass": bool(result.get("pass")), "details": result}, 200
