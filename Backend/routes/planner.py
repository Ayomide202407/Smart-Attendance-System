from datetime import datetime
from flask import Blueprint, request

from database.engine import SessionLocal
from database.models import User, Enrollment, Course, StudentPlan

bp = Blueprint("planner", __name__, url_prefix="/planner")


def _json_error(message: str, status_code: int = 400):
    return {"ok": False, "error": message}, status_code


def _get_user(db, user_id: str):
    if not user_id:
        return None
    return db.query(User).filter(User.id == user_id).first()


def _parse_dt(s: str):
    if not s:
        return None
    try:
        dt = datetime.fromisoformat(str(s).replace("Z", "+00:00"))
        if dt.tzinfo is not None:
            return dt.astimezone(tz=None).replace(tzinfo=None)
        return dt
    except Exception:
        return None


def _format_plan(p: StudentPlan):
    return {
        "id": p.id,
        "student_id": p.student_id,
        "course_id": p.course_id,
        "item_type": p.item_type,
        "title": p.title,
        "start_time": p.start_time.isoformat() if p.start_time else None,
        "duration_minutes": p.duration_minutes,
        "status": p.status,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


@bp.post("/create")
def create_plan():
    data = request.get_json(silent=True) or {}
    student_id = str(data.get("student_id") or "").strip()
    item_type = str(data.get("item_type") or "").strip().lower()
    title = str(data.get("title") or "").strip() or None
    course_id = str(data.get("course_id") or "").strip() or None
    start_time = _parse_dt(data.get("start_time"))
    duration_minutes = int(data.get("duration_minutes") or 60)

    if not student_id:
        return _json_error("Missing field: student_id", 400)
    if item_type not in ("study", "tutorial", "reading", "project", "research", "other"):
        return _json_error("Invalid item_type", 400)
    if not start_time:
        return _json_error("start_time must be a valid ISO datetime", 400)
    if duration_minutes < 30 or duration_minutes > 600 or duration_minutes % 30 != 0:
        return _json_error("duration_minutes must be in 30-minute blocks (min 30, max 600)", 400)

    db = SessionLocal()
    try:
        student = _get_user(db, student_id)
        if not student or student.role != "student":
            return _json_error("Student not found / invalid role", 403)

        if course_id:
            course = db.query(Course).filter(Course.id == course_id).first()
            if not course:
                return _json_error("Course not found", 404)
            enrolled = db.query(Enrollment).filter(Enrollment.student_id == student.id).filter(Enrollment.course_id == course.id).first()
            if not enrolled:
                return _json_error("Student not enrolled in this course", 403)

        plan = StudentPlan(
            student_id=student.id,
            course_id=course_id,
            item_type=item_type,
            title=title,
            start_time=start_time,
            duration_minutes=duration_minutes,
            status="planned",
        )
        db.add(plan)
        db.commit()
        db.refresh(plan)
        return {"ok": True, "plan": _format_plan(plan)}, 201
    except Exception as e:
        db.rollback()
        return _json_error(f"Create plan failed: {str(e)}", 500)
    finally:
        db.close()


@bp.post("/update")
def update_plan():
    data = request.get_json(silent=True) or {}
    student_id = str(data.get("student_id") or "").strip()
    plan_id = str(data.get("plan_id") or "").strip()
    item_type = str(data.get("item_type") or "").strip().lower()
    title = str(data.get("title") or "").strip() or None
    course_id = str(data.get("course_id") or "").strip() or None
    start_time = _parse_dt(data.get("start_time"))
    duration_minutes = int(data.get("duration_minutes") or 60)

    if not student_id:
        return _json_error("Missing field: student_id", 400)
    if not plan_id:
        return _json_error("Missing field: plan_id", 400)
    if item_type not in ("study", "tutorial", "reading", "project", "research", "other"):
        return _json_error("Invalid item_type", 400)
    if not start_time:
        return _json_error("start_time must be a valid ISO datetime", 400)
    if duration_minutes < 30 or duration_minutes > 600 or duration_minutes % 30 != 0:
        return _json_error("duration_minutes must be in 30-minute blocks (min 30, max 600)", 400)

    db = SessionLocal()
    try:
        student = _get_user(db, student_id)
        if not student or student.role != "student":
            return _json_error("Student not found / invalid role", 403)

        plan = db.query(StudentPlan).filter(StudentPlan.id == plan_id).first()
        if not plan or plan.student_id != student.id:
            return _json_error("Plan not found", 404)

        if course_id:
            course = db.query(Course).filter(Course.id == course_id).first()
            if not course:
                return _json_error("Course not found", 404)
            enrolled = db.query(Enrollment).filter(Enrollment.student_id == student.id).filter(Enrollment.course_id == course.id).first()
            if not enrolled:
                return _json_error("Student not enrolled in this course", 403)

        plan.item_type = item_type
        plan.title = title
        plan.course_id = course_id
        plan.start_time = start_time
        plan.duration_minutes = duration_minutes
        db.commit()
        db.refresh(plan)
        return {"ok": True, "plan": _format_plan(plan)}, 200
    except Exception as e:
        db.rollback()
        return _json_error(f"Update plan failed: {str(e)}", 500)
    finally:
        db.close()


@bp.post("/status")
def update_plan_status():
    data = request.get_json(silent=True) or {}
    student_id = str(data.get("student_id") or "").strip()
    plan_id = str(data.get("plan_id") or "").strip()
    status = str(data.get("status") or "").strip().lower()

    if not student_id:
        return _json_error("Missing field: student_id", 400)
    if not plan_id:
        return _json_error("Missing field: plan_id", 400)
    if status not in ("planned", "completed", "missed"):
        return _json_error("status must be planned|completed|missed", 400)

    db = SessionLocal()
    try:
        student = _get_user(db, student_id)
        if not student or student.role != "student":
            return _json_error("Student not found / invalid role", 403)

        plan = db.query(StudentPlan).filter(StudentPlan.id == plan_id).first()
        if not plan or plan.student_id != student.id:
            return _json_error("Plan not found", 404)

        plan.status = status
        db.commit()
        db.refresh(plan)
        return {"ok": True, "plan": _format_plan(plan)}, 200
    except Exception as e:
        db.rollback()
        return _json_error(f"Update status failed: {str(e)}", 500)
    finally:
        db.close()


@bp.post("/delete")
def delete_plan():
    data = request.get_json(silent=True) or {}
    student_id = str(data.get("student_id") or "").strip()
    plan_id = str(data.get("plan_id") or "").strip()

    if not student_id:
        return _json_error("Missing field: student_id", 400)
    if not plan_id:
        return _json_error("Missing field: plan_id", 400)

    db = SessionLocal()
    try:
        student = _get_user(db, student_id)
        if not student or student.role != "student":
            return _json_error("Student not found / invalid role", 403)

        plan = db.query(StudentPlan).filter(StudentPlan.id == plan_id).first()
        if not plan or plan.student_id != student.id:
            return _json_error("Plan not found", 404)

        db.delete(plan)
        db.commit()
        return {"ok": True, "message": "Deleted"}, 200
    except Exception as e:
        db.rollback()
        return _json_error(f"Delete failed: {str(e)}", 500)
    finally:
        db.close()


@bp.get("/student/<student_id>")
def list_plans(student_id: str):
    start = str(request.args.get("from") or "").strip()
    end = str(request.args.get("to") or "").strip()

    db = SessionLocal()
    try:
        student = _get_user(db, student_id)
        if not student or student.role != "student":
            return _json_error("Student not found / invalid role", 403)

        q = db.query(StudentPlan).filter(StudentPlan.student_id == student.id)
        if start:
            dt = _parse_dt(start)
            if dt:
                q = q.filter(StudentPlan.start_time >= dt)
        if end:
            dt = _parse_dt(end)
            if dt:
                q = q.filter(StudentPlan.start_time <= dt)

        rows = q.order_by(StudentPlan.start_time.asc()).all()
        return {"ok": True, "count": len(rows), "plans": [_format_plan(r) for r in rows]}, 200
    finally:
        db.close()
