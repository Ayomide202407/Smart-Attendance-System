import cv2
import numpy as np
import time
from utils.embeddings import crop_face_xyxy, blur_score
from utils.embeddings import EMB_DIR
from utils.face_engine import extract_all_embeddings_with_landmarks
from utils.liveness import evaluate_liveness
from live.recognizer import FaceRecognizer
from datetime import datetime, timedelta

from flask import Blueprint, request
from sqlalchemy.exc import IntegrityError

from database.engine import SessionLocal
from config import Config
from database.models import User, Course, Session, Enrollment, Attendance, AttendanceAudit, AttendanceDispute

bp = Blueprint("attendance", __name__, url_prefix="/attendance")


def _json_error(message: str, status_code: int = 400):
    return {"ok": False, "error": message}, status_code


def _get_user(db, user_id: str):
    if not user_id:
        return None
    return db.query(User).filter(User.id == user_id).first()


def _get_active_session(db, course_id: str):
    return (
        db.query(Session)
        .filter(Session.course_id == course_id)
        .filter(Session.status == "active")
        .first()
    )


def _is_enrolled(db, student_id: str, course_id: str) -> bool:
    return (
        db.query(Enrollment)
        .filter(Enrollment.student_id == student_id)
        .filter(Enrollment.course_id == course_id)
        .first()
        is not None
    )


def _recently_marked(db, session_id: str, student_id: str, minutes: int) -> bool:
    if minutes <= 0:
        return False
    rec = (
        db.query(Attendance)
        .filter(Attendance.session_id == session_id)
        .filter(Attendance.student_id == student_id)
        .first()
    )
    if not rec or not rec.timestamp:
        return False
    cutoff = datetime.utcnow() - timedelta(minutes=minutes)
    return rec.timestamp >= cutoff


@bp.post("/mark")
def mark_attendance():
    """
    Mark attendance for students in an ACTIVE session.

    POST /attendance/mark
    Body JSON:
    {
      "lecturer_id": "...",
      "course_id": "...",
      "method": "image_upload" | "live_video",
      "confidence": 0.87,                 # optional
      "student_ids": ["id1","id2","id3"]  # list of student UUIDs
    }

    Rules:
    - lecturer must own the course
    - there must be an active session for the course
    - each student must exist + be role student
    - each student must be enrolled in the course
    - no duplicate attendance per student per session (DB constraint)
    """
    data = request.get_json(silent=True) or {}

    lecturer_id = str(data.get("lecturer_id") or "").strip()
    course_id = str(data.get("course_id") or "").strip()
    method = str(data.get("method") or "image_upload").strip()
    confidence = data.get("confidence", None)
    confidences = data.get("confidences", None)
    student_ids = data.get("student_ids") or []

    if not lecturer_id:
        return _json_error("Missing field: lecturer_id", 400)
    if not course_id:
        return _json_error("Missing field: course_id", 400)
    if method not in ("image_upload", "live_video"):
        return _json_error("method must be 'image_upload' or 'live_video'", 400)
    if not isinstance(student_ids, list) or len(student_ids) == 0:
        return _json_error("student_ids must be a non-empty list", 400)

    # Normalize student_ids (trim + dedupe)
    normalized = []
    seen = set()
    for sid in student_ids:
        s = str(sid).strip()
        if s and s not in seen:
            normalized.append(s)
            seen.add(s)

    if len(normalized) == 0:
        return _json_error("student_ids must contain at least one valid id", 400)

    db = SessionLocal()
    try:
        lecturer = _get_user(db, lecturer_id)
        if not lecturer:
            return _json_error("Lecturer not found", 404)
        if lecturer.role != "lecturer":
            return _json_error("Only lecturers can mark attendance", 403)

        course = db.query(Course).filter(Course.id == course_id).first()
        if not course:
            return _json_error("Course not found", 404)
        if course.lecturer_id != lecturer.id:
            return _json_error("You do not own this course", 403)

        active_session = _get_active_session(db, course.id)
        if not active_session:
            return _json_error("No active session for this course", 403)

        marked = []
        skipped = []

        for sid in normalized:
            student = _get_user(db, sid)
            if not student or student.role != "student":
                skipped.append({"student_id": sid, "reason": "student_not_found"})
                continue

            if not _is_enrolled(db, student.id, course.id):
                skipped.append({"student_id": student.id, "reason": "not_enrolled"})
                continue

            if _recently_marked(db, active_session.id, student.id, Config.COOLDOWN_MINUTES):
                skipped.append({"student_id": student.id, "reason": "cooldown_active"})
                continue

            conf_value = None
            if isinstance(confidences, dict):
                conf_value = confidences.get(student.id)
            elif confidence is not None:
                conf_value = confidence

            record = Attendance(
                session_id=active_session.id,
                student_id=student.id,
                timestamp=datetime.utcnow(),
                status="present",
                method=method,
                confidence=float(conf_value) if conf_value is not None else None,
            )

            db.add(record)
            try:
                db.commit()
                db.refresh(record)
                marked.append({
                    "student_id": student.id,
                    "attendance_id": record.id,
                    "timestamp": record.timestamp.isoformat(),
                    "method": record.method,
                })
            except IntegrityError:
                db.rollback()
                skipped.append({"student_id": student.id, "reason": "already_marked"})
            except Exception as e:
                db.rollback()
                skipped.append({"student_id": student.id, "reason": f"db_error: {str(e)}"})

        return {
            "ok": True,
            "course_id": course.id,
            "session_id": active_session.id,
            "marked_count": len(marked),
            "skipped_count": len(skipped),
            "marked": marked,
            "skipped": skipped,
        }, 200

    except Exception as e:
        db.rollback()
        return _json_error(f"Mark attendance failed: {str(e)}", 500)
    finally:
        db.close()


@bp.get("/session/<session_id>")
def session_attendance(session_id: str):
    """
    GET /attendance/session/<session_id>
    Returns attendance records for a session.
    """
    db = SessionLocal()
    try:
        session = db.query(Session).filter(Session.id == session_id).first()
        if not session:
            return _json_error("Session not found", 404)

        records = db.query(Attendance).filter(Attendance.session_id == session.id).all()

        out = []
        for r in records:
            out.append({
                "attendance_id": r.id,
                "student_id": r.student_id,
                "timestamp": r.timestamp.isoformat(),
                "status": r.status,
                "method": r.method,
                "confidence": r.confidence,
            })

        return {"ok": True, "count": len(out), "records": out}, 200
    finally:
        db.close()

@bp.post("/scan-image")
def scan_image():
    """
    Lecturer uploads ONE image (class photo) or a camera frame.
    Backend detects faces, recognizes students, and returns student_ids.

    POST /attendance/scan-image (multipart/form-data)
    Fields:
    - lecturer_id
    - course_id
    - image (file)
    - threshold (optional)
    - blur_threshold (optional)

    Returns:
    { ok, detected_faces, matched_count, student_ids: [...], matches:[...] }
    """
    lecturer_id = (request.form.get("lecturer_id") or "").strip()
    course_id = (request.form.get("course_id") or "").strip()
    threshold = float(request.form.get("threshold") or 0.4)
    blur_threshold = float(request.form.get("blur_threshold") or Config.BLUR_THRESHOLD)
    debug = str(request.form.get("debug") or "").strip().lower() in ("1", "true", "yes", "on")
    debug_top_k = int(request.form.get("debug_top_k") or 5)
    liveness_override = str(request.form.get("liveness") or "").strip().lower()
    if liveness_override in ("1", "true", "yes", "on"):
        liveness_enabled = True
    elif liveness_override in ("0", "false", "no", "off"):
        liveness_enabled = False
    else:
        liveness_enabled = Config.LIVENESS_ENABLED and Config.LIVENESS_ATTENDANCE_ENABLED

    if not lecturer_id:
        return _json_error("Missing form field: lecturer_id", 400)
    if not course_id:
        return _json_error("Missing form field: course_id", 400)
    if "image" not in request.files:
        return _json_error("Missing file field: image", 400)

    file = request.files["image"]
    data = file.read()
    np_img = np.frombuffer(data, np.uint8)
    image = cv2.imdecode(np_img, cv2.IMREAD_COLOR)
    if image is None:
        return _json_error("Invalid image upload", 400)

    db = SessionLocal()
    try:
        lecturer = _get_user(db, lecturer_id)
        if not lecturer or lecturer.role != "lecturer":
            return _json_error("Lecturer not found / invalid role", 403)

        course = db.query(Course).filter(Course.id == course_id).first()
        if not course:
            return _json_error("Course not found", 404)
        if course.lecturer_id != lecturer.id:
            return _json_error("You do not own this course", 403)

        active_session = _get_active_session(db, course.id)
        if not active_session:
            return _json_error("No active session for this course", 403)

        recognizer = FaceRecognizer(EMB_DIR, threshold=threshold)

        faces = extract_all_embeddings_with_landmarks(image)
        if not faces:
            return {"ok": True, "detected_faces": 0, "matched_count": 0, "student_ids": [], "matches": []}, 200

        matched_ids = set()
        matches = []
        debug_faces = [] if debug else None

        for emb, bbox, det_score, landmarks in faces:
            if det_score < Config.OPENCV_DET_THRESH:
                if debug:
                    debug_faces.append({
                        "bbox": bbox,
                        "det_score": float(det_score),
                        "skipped_reason": "low_det_score",
                    })
                continue
            face = crop_face_xyxy(image, bbox)
            if blur_score(face) < blur_threshold:
                if debug:
                    debug_faces.append({
                        "bbox": bbox,
                        "det_score": float(det_score),
                        "blur_score": float(blur_score(face)),
                        "skipped_reason": "blur",
                    })
                continue

            liveness = evaluate_liveness(image, bbox, landmarks) if liveness_enabled else {"checked": False}
            if liveness_enabled:
                if not liveness.get("checked") and Config.LIVENESS_REQUIRED:
                    if debug:
                        debug_faces.append({
                            "bbox": bbox,
                            "det_score": float(det_score),
                            "blur_score": float(blur_score(face)),
                            "liveness": liveness,
                            "skipped_reason": "liveness_unavailable",
                        })
                    continue
                if liveness.get("checked") and not liveness.get("pass"):
                    if debug:
                        debug_faces.append({
                            "bbox": bbox,
                            "det_score": float(det_score),
                            "blur_score": float(blur_score(face)),
                            "liveness": liveness,
                            "skipped_reason": "liveness_failed",
                        })
                    continue

            sid, sim = recognizer.recognize_embedding(emb)
            if not sid:
                if debug:
                    debug_faces.append({
                        "bbox": bbox,
                        "det_score": float(det_score),
                        "blur_score": float(blur_score(face)),
                        "liveness": liveness,
                        "top_k": recognizer.top_k(emb, k=debug_top_k),
                        "skipped_reason": "below_threshold",
                    })
                continue

            # only accept enrolled students
            if not _is_enrolled(db, sid, course.id):
                if debug:
                    debug_faces.append({
                        "bbox": bbox,
                        "det_score": float(det_score),
                        "blur_score": float(blur_score(face)),
                        "liveness": liveness,
                        "top_k": recognizer.top_k(emb, k=debug_top_k),
                        "skipped_reason": "not_enrolled",
                        "matched_student_id": sid,
                        "similarity": float(sim),
                    })
                continue

            if _recently_marked(db, active_session.id, sid, Config.COOLDOWN_MINUTES):
                if debug:
                    debug_faces.append({
                        "bbox": bbox,
                        "det_score": float(det_score),
                        "blur_score": float(blur_score(face)),
                        "liveness": liveness,
                        "top_k": recognizer.top_k(emb, k=debug_top_k),
                        "skipped_reason": "cooldown",
                        "matched_student_id": sid,
                        "similarity": float(sim),
                    })
                continue

            matched_ids.add(sid)
            matches.append({
                "student_id": sid,
                "similarity": float(sim),
                "liveness_checked": bool(liveness.get("checked")),
                "liveness_score": float(liveness.get("score", 0.0)),
                "liveness_pass": bool(liveness.get("pass", False)),
            })
            if debug:
                debug_faces.append({
                    "bbox": bbox,
                    "det_score": float(det_score),
                    "blur_score": float(blur_score(face)),
                    "liveness": liveness,
                    "top_k": recognizer.top_k(emb, k=debug_top_k),
                    "matched_student_id": sid,
                    "similarity": float(sim),
                    "skipped_reason": None,
                })

        resp = {
            "ok": True,
            "detected_faces": int(len(faces)),
            "matched_count": int(len(matched_ids)),
            "student_ids": list(matched_ids),
            "matches": matches,
        }
        if debug:
            resp["debug"] = {
                "threshold": threshold,
                "blur_threshold": blur_threshold,
                "faces": debug_faces or [],
            }
        return resp, 200

    finally:
        db.close()


@bp.post("/benchmark")
def benchmark():
    """
    Benchmark face detection + embedding + matching on a single image.

    POST /attendance/benchmark (multipart/form-data)
    Fields:
    - image (file)
    - threshold (optional, default 0.8)
    - blur_threshold (optional, default 80.0)
    - course_id (optional)   -> if provided, only count enrolled matches
    """
    threshold = float(request.form.get("threshold") or 0.4)
    blur_threshold = float(request.form.get("blur_threshold") or Config.BLUR_THRESHOLD)
    debug = str(request.form.get("debug") or "").strip().lower() in ("1", "true", "yes", "on")
    debug_top_k = int(request.form.get("debug_top_k") or 5)
    liveness_override = str(request.form.get("liveness") or "").strip().lower()
    if liveness_override in ("1", "true", "yes", "on"):
        liveness_enabled = True
    elif liveness_override in ("0", "false", "no", "off"):
        liveness_enabled = False
    else:
        liveness_enabled = Config.LIVENESS_ENABLED and Config.LIVENESS_ATTENDANCE_ENABLED
    course_id = (request.form.get("course_id") or "").strip() or None

    if "image" not in request.files:
        return _json_error("Missing file field: image", 400)

    t0 = time.perf_counter()
    file = request.files["image"]
    data = file.read()
    np_img = np.frombuffer(data, np.uint8)
    image = cv2.imdecode(np_img, cv2.IMREAD_COLOR)
    if image is None:
        return _json_error("Invalid image upload", 400)
    t_decode = time.perf_counter()

    recognizer = FaceRecognizer(EMB_DIR, threshold=threshold)

    faces = extract_all_embeddings_with_landmarks(image)
    t_detect = time.perf_counter()

    matched_ids = set()
    matches = []
    debug_faces = [] if debug else None

    db = SessionLocal()
    try:
        for emb, bbox, det_score, landmarks in faces:
            if det_score < Config.OPENCV_DET_THRESH:
                if debug:
                    debug_faces.append({"bbox": bbox, "det_score": float(det_score), "skipped_reason": "low_det_score"})
                continue
            face = crop_face_xyxy(image, bbox)
            if blur_score(face) < blur_threshold:
                if debug:
                    debug_faces.append({
                        "bbox": bbox,
                        "det_score": float(det_score),
                        "blur_score": float(blur_score(face)),
                        "skipped_reason": "blur",
                    })
                continue

            liveness = evaluate_liveness(image, bbox, landmarks) if liveness_enabled else {"checked": False}
            if liveness_enabled:
                if not liveness.get("checked") and Config.LIVENESS_REQUIRED:
                    if debug:
                        debug_faces.append({
                            "bbox": bbox,
                            "det_score": float(det_score),
                            "blur_score": float(blur_score(face)),
                            "liveness": liveness,
                            "skipped_reason": "liveness_unavailable",
                        })
                    continue
                if liveness.get("checked") and not liveness.get("pass"):
                    if debug:
                        debug_faces.append({
                            "bbox": bbox,
                            "det_score": float(det_score),
                            "blur_score": float(blur_score(face)),
                            "liveness": liveness,
                            "skipped_reason": "liveness_failed",
                        })
                    continue

            sid, sim = recognizer.recognize_embedding(emb)
            if not sid:
                if debug:
                    debug_faces.append({
                        "bbox": bbox,
                        "det_score": float(det_score),
                        "blur_score": float(blur_score(face)),
                        "liveness": liveness,
                        "top_k": recognizer.top_k(emb, k=debug_top_k),
                        "skipped_reason": "below_threshold",
                    })
                continue

            # optional: only count enrolled students for a given course
            if course_id:
                if not _is_enrolled(db, sid, course_id):
                    if debug:
                        debug_faces.append({
                            "bbox": bbox,
                            "det_score": float(det_score),
                            "blur_score": float(blur_score(face)),
                            "liveness": liveness,
                            "top_k": recognizer.top_k(emb, k=debug_top_k),
                            "skipped_reason": "not_enrolled",
                            "matched_student_id": sid,
                            "similarity": float(sim),
                        })
                    continue

            matched_ids.add(sid)
            matches.append({
                "student_id": sid,
                "similarity": float(sim),
                "liveness_checked": bool(liveness.get("checked")),
                "liveness_score": float(liveness.get("score", 0.0)),
                "liveness_pass": bool(liveness.get("pass", False)),
            })
            if debug:
                debug_faces.append({
                    "bbox": bbox,
                    "det_score": float(det_score),
                    "blur_score": float(blur_score(face)),
                    "liveness": liveness,
                    "top_k": recognizer.top_k(emb, k=debug_top_k),
                    "matched_student_id": sid,
                    "similarity": float(sim),
                    "skipped_reason": None,
                })
    finally:
        db.close()

    t_match = time.perf_counter()

    resp = {
        "ok": True,
        "detected_faces": int(len(faces)),
        "matched_count": int(len(matched_ids)),
        "threshold": threshold,
        "blur_threshold": blur_threshold,
        "timings_ms": {
            "decode": round((t_decode - t0) * 1000, 2),
            "detect_embed": round((t_detect - t_decode) * 1000, 2),
            "match": round((t_match - t_detect) * 1000, 2),
            "total": round((t_match - t0) * 1000, 2),
        },
        "matches": matches,
    }
    if debug:
        resp["debug"] = {
            "faces": debug_faces or [],
        }
    return resp, 200


@bp.post("/manual")
def manual_override():
    """
    Lecturer manually marks or unmarks a student for a session.

    POST /attendance/manual
    Body JSON:
    {
      "lecturer_id": "...",
      "session_id": "...",
      "student_id": "...",
      "action": "mark" | "unmark",
      "reason": "optional text"
    }
    """
    data = request.get_json(silent=True) or {}

    lecturer_id = str(data.get("lecturer_id") or "").strip()
    session_id = str(data.get("session_id") or "").strip()
    student_id = str(data.get("student_id") or "").strip()
    action = str(data.get("action") or "").strip().lower()
    reason = str(data.get("reason") or "").strip() or None

    if not lecturer_id:
        return _json_error("Missing field: lecturer_id", 400)
    if not session_id:
        return _json_error("Missing field: session_id", 400)
    if not student_id:
        return _json_error("Missing field: student_id", 400)
    if action not in ("mark", "unmark"):
        return _json_error("action must be 'mark' or 'unmark'", 400)

    db = SessionLocal()
    try:
        lecturer = _get_user(db, lecturer_id)
        if not lecturer or lecturer.role != "lecturer":
            return _json_error("Lecturer not found / invalid role", 403)

        session = db.query(Session).filter(Session.id == session_id).first()
        if not session:
            return _json_error("Session not found", 404)
        if session.lecturer_id != lecturer.id:
            return _json_error("You do not own this session", 403)

        student = _get_user(db, student_id)
        if not student or student.role != "student":
            return _json_error("Student not found / invalid role", 404)

        if not _is_enrolled(db, student.id, session.course_id):
            return _json_error("Student is not enrolled in this course", 403)

        existing = (
            db.query(Attendance)
            .filter(Attendance.session_id == session.id)
            .filter(Attendance.student_id == student.id)
            .first()
        )

        if action == "mark":
            if not existing:
                record = Attendance(
                    session_id=session.id,
                    student_id=student.id,
                    timestamp=datetime.utcnow(),
                    status="present",
                    method="manual",
                    confidence=None,
                )
                db.add(record)
        else:
            if existing:
                db.delete(existing)

        audit = AttendanceAudit(
            session_id=session.id,
            student_id=student.id,
            lecturer_id=lecturer.id,
            action=action,
            reason=reason,
            timestamp=datetime.utcnow(),
        )
        db.add(audit)
        db.commit()

        return {
            "ok": True,
            "message": "Manual override applied",
            "action": action,
            "session_id": session.id,
            "student_id": student.id,
        }, 200
    except Exception as e:
        db.rollback()
        return _json_error(f"Manual override failed: {str(e)}", 500)
    finally:
        db.close()


@bp.post("/dispute")
def open_dispute():
    """
    Student opens a dispute for a session.

    POST /attendance/dispute
    Body JSON:
    {
      "student_id": "...",
      "session_id": "...",
      "dispute_type": "missing" | "incorrect",
      "reason": "optional text"
    }
    """
    data = request.get_json(silent=True) or {}

    student_id = str(data.get("student_id") or "").strip()
    session_id = str(data.get("session_id") or "").strip()
    dispute_type = str(data.get("dispute_type") or "").strip().lower()
    reason = str(data.get("reason") or "").strip() or None

    if not student_id:
        return _json_error("Missing field: student_id", 400)
    if not session_id:
        return _json_error("Missing field: session_id", 400)
    if dispute_type not in ("missing", "incorrect"):
        return _json_error("dispute_type must be 'missing' or 'incorrect'", 400)

    db = SessionLocal()
    try:
        student = _get_user(db, student_id)
        if not student or student.role != "student":
            return _json_error("Student not found / invalid role", 403)

        session = db.query(Session).filter(Session.id == session_id).first()
        if not session:
            return _json_error("Session not found", 404)

        if not _is_enrolled(db, student.id, session.course_id):
            return _json_error("You are not enrolled in this course", 403)

        existing = (
            db.query(AttendanceDispute)
            .filter(AttendanceDispute.session_id == session.id)
            .filter(AttendanceDispute.student_id == student.id)
            .filter(AttendanceDispute.status == "pending")
            .first()
        )
        if existing:
            return _json_error("A pending dispute already exists for this session", 409)

        row = AttendanceDispute(
            session_id=session.id,
            course_id=session.course_id,
            student_id=student.id,
            dispute_type=dispute_type,
            reason=reason,
            status="pending",
        )
        db.add(row)
        db.commit()
        db.refresh(row)

        return {
            "ok": True,
            "message": "Dispute created",
            "dispute": {
                "id": row.id,
                "session_id": row.session_id,
                "course_id": row.course_id,
                "student_id": row.student_id,
                "dispute_type": row.dispute_type,
                "status": row.status,
                "reason": row.reason,
                "created_at": row.created_at.isoformat(),
            },
        }, 201
    except Exception as e:
        db.rollback()
        return _json_error(f"Create dispute failed: {str(e)}", 500)
    finally:
        db.close()


@bp.get("/disputes/student/<student_id>")
def list_student_disputes(student_id: str):
    db = SessionLocal()
    try:
        student = _get_user(db, student_id)
        if not student or student.role != "student":
            return _json_error("Student not found / invalid role", 403)

        rows = (
            db.query(AttendanceDispute)
            .filter(AttendanceDispute.student_id == student.id)
            .order_by(AttendanceDispute.created_at.desc())
            .all()
        )

        out = []
        for r in rows:
            out.append({
                "id": r.id,
                "session_id": r.session_id,
                "course_id": r.course_id,
                "dispute_type": r.dispute_type,
                "status": r.status,
                "reason": r.reason,
                "resolution_note": r.resolution_note,
                "created_at": r.created_at.isoformat(),
                "resolved_at": r.resolved_at.isoformat() if r.resolved_at else None,
            })
        return {"ok": True, "count": len(out), "disputes": out}, 200
    finally:
        db.close()


@bp.get("/disputes/course/<course_id>")
def list_course_disputes(course_id: str):
    lecturer_id = str(request.args.get("lecturer_id") or "").strip()
    status = str(request.args.get("status") or "").strip().lower() or None

    db = SessionLocal()
    try:
        course = db.query(Course).filter(Course.id == course_id).first()
        if not course:
            return _json_error("Course not found", 404)

        if lecturer_id:
            lecturer = _get_user(db, lecturer_id)
            if not lecturer or lecturer.role != "lecturer":
                return _json_error("Lecturer not found / invalid role", 403)
            if course.lecturer_id != lecturer.id:
                return _json_error("You do not own this course", 403)

        q = db.query(AttendanceDispute).filter(AttendanceDispute.course_id == course.id)
        if status in ("pending", "approved", "rejected"):
            q = q.filter(AttendanceDispute.status == status)

        rows = q.order_by(AttendanceDispute.created_at.desc()).all()
        out = []
        for r in rows:
            out.append({
                "id": r.id,
                "session_id": r.session_id,
                "course_id": r.course_id,
                "student_id": r.student_id,
                "dispute_type": r.dispute_type,
                "status": r.status,
                "reason": r.reason,
                "resolution_note": r.resolution_note,
                "created_at": r.created_at.isoformat(),
                "resolved_at": r.resolved_at.isoformat() if r.resolved_at else None,
                "resolver_id": r.resolver_id,
            })
        return {"ok": True, "count": len(out), "disputes": out}, 200
    finally:
        db.close()


@bp.post("/disputes/resolve")
def resolve_dispute():
    """
    Lecturer resolves a dispute.

    POST /attendance/disputes/resolve
    Body JSON:
    {
      "lecturer_id": "...",
      "dispute_id": "...",
      "action": "approve" | "reject",
      "resolution_note": "optional text"
    }
    """
    data = request.get_json(silent=True) or {}

    lecturer_id = str(data.get("lecturer_id") or "").strip()
    dispute_id = str(data.get("dispute_id") or "").strip()
    action = str(data.get("action") or "").strip().lower()
    resolution_note = str(data.get("resolution_note") or "").strip() or None

    if not lecturer_id:
        return _json_error("Missing field: lecturer_id", 400)
    if not dispute_id:
        return _json_error("Missing field: dispute_id", 400)
    if action not in ("approve", "reject"):
        return _json_error("action must be 'approve' or 'reject'", 400)

    db = SessionLocal()
    try:
        lecturer = _get_user(db, lecturer_id)
        if not lecturer or lecturer.role != "lecturer":
            return _json_error("Lecturer not found / invalid role", 403)

        dispute = db.query(AttendanceDispute).filter(AttendanceDispute.id == dispute_id).first()
        if not dispute:
            return _json_error("Dispute not found", 404)

        session = db.query(Session).filter(Session.id == dispute.session_id).first()
        if not session:
            return _json_error("Session not found", 404)
        if session.lecturer_id != lecturer.id:
            return _json_error("You do not own this session", 403)

        if dispute.status != "pending":
            return _json_error("Dispute already resolved", 409)

        # If approved, apply attendance fix based on dispute_type
        if action == "approve":
            existing = (
                db.query(Attendance)
                .filter(Attendance.session_id == dispute.session_id)
                .filter(Attendance.student_id == dispute.student_id)
                .first()
            )
            if dispute.dispute_type == "missing":
                if not existing:
                    record = Attendance(
                        session_id=dispute.session_id,
                        student_id=dispute.student_id,
                        timestamp=datetime.utcnow(),
                        status="present",
                        method="manual",
                        confidence=None,
                    )
                    db.add(record)
                db.add(AttendanceAudit(
                    session_id=dispute.session_id,
                    student_id=dispute.student_id,
                    lecturer_id=lecturer.id,
                    action="mark",
                    reason="Dispute approved: missing",
                    timestamp=datetime.utcnow(),
                ))
            elif dispute.dispute_type == "incorrect":
                if existing:
                    db.delete(existing)
                db.add(AttendanceAudit(
                    session_id=dispute.session_id,
                    student_id=dispute.student_id,
                    lecturer_id=lecturer.id,
                    action="unmark",
                    reason="Dispute approved: incorrect",
                    timestamp=datetime.utcnow(),
                ))

            dispute.status = "approved"
        else:
            dispute.status = "rejected"

        dispute.resolution_note = resolution_note
        dispute.resolved_at = datetime.utcnow()
        dispute.resolver_id = lecturer.id

        db.commit()

        return {
            "ok": True,
            "message": "Dispute resolved",
            "dispute_id": dispute.id,
            "status": dispute.status,
        }, 200
    except Exception as e:
        db.rollback()
        return _json_error(f"Resolve dispute failed: {str(e)}", 500)
    finally:
        db.close()
