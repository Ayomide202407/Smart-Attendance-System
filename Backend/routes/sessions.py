from datetime import datetime

from flask import Blueprint, request

from database.engine import SessionLocal
from database.models import User, Course, Session

bp = Blueprint("sessions", __name__, url_prefix="/sessions")


def _json_error(message: str, status_code: int = 400):
    return {"ok": False, "error": message}, status_code


def _get_user(db, user_id: str):
    if not user_id:
        return None
    return db.query(User).filter(User.id == user_id).first()


@bp.post("/start")
def start_session():
    """
    Lecturer starts an attendance session for a course.

    POST /sessions/start
    Body JSON:
    {
      "lecturer_id": "...",
      "course_id": "..."
    }

    Rules:
    - lecturer must exist and role == lecturer
    - course must exist
    - lecturer must own the course
    - only ONE active session per course at a time
    """
    data = request.get_json(silent=True) or {}
    lecturer_id = str(data.get("lecturer_id") or "").strip()
    course_id = str(data.get("course_id") or "").strip()

    if not lecturer_id:
        return _json_error("Missing field: lecturer_id", 400)
    if not course_id:
        return _json_error("Missing field: course_id", 400)

    db = SessionLocal()
    try:
        lecturer = _get_user(db, lecturer_id)
        if not lecturer:
            return _json_error("Lecturer not found", 404)
        if lecturer.role != "lecturer":
            return _json_error("Only lecturers can start sessions", 403)

        course = db.query(Course).filter(Course.id == course_id).first()
        if not course:
            return _json_error("Course not found", 404)
        if course.lecturer_id != lecturer.id:
            return _json_error("You do not own this course", 403)

        # Check existing active session
        existing = (
            db.query(Session)
            .filter(Session.course_id == course.id)
            .filter(Session.status == "active")
            .first()
        )
        if existing:
            return {
                "ok": True,
                "message": "Session already active",
                "session": {
                    "id": existing.id,
                    "course_id": existing.course_id,
                    "lecturer_id": existing.lecturer_id,
                    "status": existing.status,
                    "start_time": existing.start_time.isoformat(),
                    "end_time": existing.end_time.isoformat() if existing.end_time else None,
                },
            }, 200

        session = Session(
            course_id=course.id,
            lecturer_id=lecturer.id,
            status="active",
            start_time=datetime.utcnow(),
            end_time=None,
        )
        db.add(session)
        db.commit()
        db.refresh(session)

        return {
            "ok": True,
            "message": "Session started",
            "session": {
                "id": session.id,
                "course_id": session.course_id,
                "lecturer_id": session.lecturer_id,
                "status": session.status,
                "start_time": session.start_time.isoformat(),
                "end_time": None,
            },
        }, 201

    except Exception as e:
        db.rollback()
        return _json_error(f"Start session failed: {str(e)}", 500)
    finally:
        db.close()


@bp.post("/end")
def end_session():
    """
    Lecturer ends an attendance session.

    POST /sessions/end
    Body JSON:
    {
      "lecturer_id": "...",
      "session_id": "..."
    }

    Rules:
    - lecturer must exist and role == lecturer
    - session must exist
    - lecturer must own the session (same lecturer_id)
    - session must be active
    """
    data = request.get_json(silent=True) or {}
    lecturer_id = str(data.get("lecturer_id") or "").strip()
    session_id = str(data.get("session_id") or "").strip()

    if not lecturer_id:
        return _json_error("Missing field: lecturer_id", 400)
    if not session_id:
        return _json_error("Missing field: session_id", 400)

    db = SessionLocal()
    try:
        lecturer = _get_user(db, lecturer_id)
        if not lecturer:
            return _json_error("Lecturer not found", 404)
        if lecturer.role != "lecturer":
            return _json_error("Only lecturers can end sessions", 403)

        session = db.query(Session).filter(Session.id == session_id).first()
        if not session:
            return _json_error("Session not found", 404)

        if session.lecturer_id != lecturer.id:
            return _json_error("You do not own this session", 403)

        if session.status != "active":
            return {
                "ok": True,
                "message": "Session already ended",
                "session": {
                    "id": session.id,
                    "course_id": session.course_id,
                    "lecturer_id": session.lecturer_id,
                    "status": session.status,
                    "start_time": session.start_time.isoformat(),
                    "end_time": session.end_time.isoformat() if session.end_time else None,
                },
            }, 200

        session.status = "ended"
        session.end_time = datetime.utcnow()

        db.commit()
        db.refresh(session)

        return {
            "ok": True,
            "message": "Session ended",
            "session": {
                "id": session.id,
                "course_id": session.course_id,
                "lecturer_id": session.lecturer_id,
                "status": session.status,
                "start_time": session.start_time.isoformat(),
                "end_time": session.end_time.isoformat(),
            },
        }, 200

    except Exception as e:
        db.rollback()
        return _json_error(f"End session failed: {str(e)}", 500)
    finally:
        db.close()


@bp.get("/active/<course_id>")
def active_session(course_id: str):
    """
    GET /sessions/active/<course_id>
    Returns active session for the course (if any).
    """
    db = SessionLocal()
    try:
        session = (
            db.query(Session)
            .filter(Session.course_id == course_id)
            .filter(Session.status == "active")
            .first()
        )
        if not session:
            return {"ok": True, "active": False, "session": None}, 200

        return {
            "ok": True,
            "active": True,
            "session": {
                "id": session.id,
                "course_id": session.course_id,
                "lecturer_id": session.lecturer_id,
                "status": session.status,
                "start_time": session.start_time.isoformat(),
                "end_time": session.end_time.isoformat() if session.end_time else None,
            },
        }, 200
    finally:
        db.close()
