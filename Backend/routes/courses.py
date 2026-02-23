from datetime import datetime, timezone
from flask import Blueprint, request
from sqlalchemy.exc import IntegrityError

from database.engine import SessionLocal
from database.models import User, Course, CourseDepartment, Enrollment
from routes.meta import DEPARTMENTS

bp = Blueprint("courses", __name__, url_prefix="/courses")


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
            return dt.astimezone(timezone.utc).replace(tzinfo=None)
        return dt
    except Exception:
        return None

def _course_open_for_enrollment(course: Course) -> bool:
    if not course.is_open_for_enrollment:
        return False
    now = datetime.utcnow()
    if course.enrollment_open_at and now < course.enrollment_open_at:
        return False
    if course.enrollment_close_at and now > course.enrollment_close_at:
        return False
    return True

@bp.post("/create")
def create_course():
    """
    Lecturer creates a course.

    POST /courses/create
    Body JSON:
    {
      "lecturer_id": "...",
      "course_code": "EEE451",
      "course_title": "Final Year Project",
      "allowed_departments": ["Electronic and Electrical Engineering", "Computer Science and Engineering"],
      "is_open_for_enrollment": true
    }
    """
    data = request.get_json(silent=True) or {}

    lecturer_id = str(data.get("lecturer_id") or "").strip()
    course_code = str(data.get("course_code") or "").strip()
    course_title = str(data.get("course_title") or "").strip()
    allowed_departments = data.get("allowed_departments") or []
    is_open_for_enrollment = bool(data.get("is_open_for_enrollment", True))
    enrollment_open_at = _parse_dt(data.get("enrollment_open_at"))
    enrollment_close_at = _parse_dt(data.get("enrollment_close_at"))

    if not lecturer_id:
        return _json_error("Missing field: lecturer_id", 400)
    if not course_code:
        return _json_error("Missing field: course_code", 400)
    if not course_title:
        return _json_error("Missing field: course_title", 400)
    if not isinstance(allowed_departments, list) or len(allowed_departments) == 0:
        return _json_error("allowed_departments must be a non-empty list", 400)

    # Normalize departments (trim + remove empty + dedupe)
    normalized_depts = []
    seen = set()
    for d in allowed_departments:
        s = str(d).strip()
        if s and s.lower() not in seen:
            normalized_depts.append(s)
            seen.add(s.lower())

    if len(normalized_depts) == 0:
        return _json_error("allowed_departments must contain at least one valid department", 400)
    if any(d not in DEPARTMENTS for d in normalized_depts):
        return _json_error("allowed_departments must be valid OAU departments", 400)
    if data.get("enrollment_open_at") and enrollment_open_at is None:
        return _json_error("enrollment_open_at must be a valid ISO datetime", 400)
    if data.get("enrollment_close_at") and enrollment_close_at is None:
        return _json_error("enrollment_close_at must be a valid ISO datetime", 400)
    if enrollment_open_at and enrollment_close_at and enrollment_close_at < enrollment_open_at:
        return _json_error("enrollment_close_at must be after enrollment_open_at", 400)

    db = SessionLocal()
    try:
        lecturer = _get_user(db, lecturer_id)
        if not lecturer:
            return _json_error("Lecturer not found", 404)
        if lecturer.role != "lecturer":
            return _json_error("Only lecturers can create courses", 403)

        course = Course(
            course_code=course_code,
            course_title=course_title,
            lecturer_id=lecturer.id,
            is_open_for_enrollment=is_open_for_enrollment,
            enrollment_open_at=enrollment_open_at,
            enrollment_close_at=enrollment_close_at,
        )

        db.add(course)
        db.flush()  # get course.id

        # Add allowed departments
        dept_rows = []
        for dept in normalized_depts:
            dept_rows.append(CourseDepartment(course_id=course.id, department=dept))

        db.add_all(dept_rows)
        db.commit()
        db.refresh(course)

        return {
            "ok": True,
            "message": "Course created successfully",
            "course": {
                "id": course.id,
                "course_code": course.course_code,
                "course_title": course.course_title,
                "lecturer_id": course.lecturer_id,
                "is_open_for_enrollment": course.is_open_for_enrollment,
                "enrollment_open_at": course.enrollment_open_at.isoformat() if course.enrollment_open_at else None,
                "enrollment_close_at": course.enrollment_close_at.isoformat() if course.enrollment_close_at else None,
                "is_effectively_open": _course_open_for_enrollment(course),
                "allowed_departments": normalized_depts,
            },
        }, 201

    except IntegrityError:
        db.rollback()
        return _json_error("course_code already exists. Use a different course_code.", 409)
    except Exception as e:
        db.rollback()
        return _json_error(f"Create course failed: {str(e)}", 500)
    finally:
        db.close()


@bp.get("/lecturer/<lecturer_id>")
def lecturer_courses(lecturer_id: str):
    """
    GET /courses/lecturer/<lecturer_id>
    Lists courses created by a lecturer.
    """
    db = SessionLocal()
    try:
        lecturer = _get_user(db, lecturer_id)
        if not lecturer:
            return _json_error("Lecturer not found", 404)
        if lecturer.role != "lecturer":
            return _json_error("User is not a lecturer", 400)

        courses = db.query(Course).filter(Course.lecturer_id == lecturer.id).all()
        out = []
        for c in courses:
            depts = [d.department for d in c.departments]
            enrolled_count = (
                db.query(Enrollment).filter(Enrollment.course_id == c.id).count()
            )
            sessions_count = len(c.sessions) if c.sessions is not None else 0
            attendance_count = 0
            for s in c.sessions or []:
                attendance_count += len(s.attendance_records or [])
            attendance_rate = 0.0
            denom = enrolled_count * sessions_count
            if denom > 0:
                attendance_rate = round((attendance_count / denom) * 100.0, 2)
            out.append({
                "id": c.id,
                "course_code": c.course_code,
                "course_title": c.course_title,
                "is_open_for_enrollment": c.is_open_for_enrollment,
                "enrollment_open_at": c.enrollment_open_at.isoformat() if c.enrollment_open_at else None,
                "enrollment_close_at": c.enrollment_close_at.isoformat() if c.enrollment_close_at else None,
                "is_effectively_open": _course_open_for_enrollment(c),
                "allowed_departments": depts,
                "enrolled_count": enrolled_count,
                "sessions_count": sessions_count,
                "attendance_rate": attendance_rate,
                "created_at": c.created_at.isoformat(),
            })

        return {"ok": True, "count": len(out), "courses": out}, 200
    finally:
        db.close()


@bp.post("/set-enrollment")
def set_enrollment_status():
    """
    Lecturer opens/closes enrollment.

    POST /courses/set-enrollment
    Body JSON:
    {
      "lecturer_id": "...",
      "course_id": "...",
      "is_open_for_enrollment": true/false
    }
    """
    data = request.get_json(silent=True) or {}
    lecturer_id = str(data.get("lecturer_id") or "").strip()
    course_id = str(data.get("course_id") or "").strip()
    is_open = data.get("is_open_for_enrollment", None)
    enrollment_open_at = _parse_dt(data.get("enrollment_open_at"))
    enrollment_close_at = _parse_dt(data.get("enrollment_close_at"))

    if not lecturer_id:
        return _json_error("Missing field: lecturer_id", 400)
    if not course_id:
        return _json_error("Missing field: course_id", 400)
    if is_open is None and data.get("enrollment_open_at") is None and data.get("enrollment_close_at") is None:
        return _json_error("Provide is_open_for_enrollment and/or enrollment window fields", 400)

    db = SessionLocal()
    try:
        lecturer = _get_user(db, lecturer_id)
        if not lecturer:
            return _json_error("Lecturer not found", 404)
        if lecturer.role != "lecturer":
            return _json_error("Only lecturers can change enrollment status", 403)

        course = db.query(Course).filter(Course.id == course_id).first()
        if not course:
            return _json_error("Course not found", 404)
        if course.lecturer_id != lecturer.id:
            return _json_error("You do not own this course", 403)

        course.is_open_for_enrollment = bool(is_open)
        if data.get("enrollment_open_at") is not None:
            if enrollment_open_at is None:
                return _json_error("enrollment_open_at must be a valid ISO datetime", 400)
            course.enrollment_open_at = enrollment_open_at
        if data.get("enrollment_close_at") is not None:
            if enrollment_close_at is None:
                return _json_error("enrollment_close_at must be a valid ISO datetime", 400)
            course.enrollment_close_at = enrollment_close_at
        if course.enrollment_open_at and course.enrollment_close_at and course.enrollment_close_at < course.enrollment_open_at:
            return _json_error("enrollment_close_at must be after enrollment_open_at", 400)
        db.commit()

        return {
            "ok": True,
            "message": "Enrollment status updated",
            "course": {
                "id": course.id,
                "course_code": course.course_code,
                "is_open_for_enrollment": course.is_open_for_enrollment,
                "enrollment_open_at": course.enrollment_open_at.isoformat() if course.enrollment_open_at else None,
                "enrollment_close_at": course.enrollment_close_at.isoformat() if course.enrollment_close_at else None,
            },
        }, 200
    except Exception as e:
        db.rollback()
        return _json_error(f"Update failed: {str(e)}", 500)
    finally:
        db.close()


@bp.get("/eligible/<student_id>")
def eligible_courses(student_id: str):
    """
    Student sees courses they are eligible for by department.

    GET /courses/eligible/<student_id>?include_closed=0|1
    - returns ONLY courses where student.department is in allowed_departments
    - default excludes closed enrollment courses
    """
    include_closed = str(request.args.get("include_closed") or "0").strip() == "1"

    db = SessionLocal()
    try:
        student = _get_user(db, student_id)
        if not student:
            return _json_error("Student not found", 404)
        if student.role != "student":
            return _json_error("User is not a student", 400)

        # Find all courses that allow this student's department
        q = (
            db.query(Course)
            .join(CourseDepartment, CourseDepartment.course_id == Course.id)
            .filter(CourseDepartment.department == student.department)
        )

        if not include_closed:
            q = q.filter(Course.is_open_for_enrollment == True)  # noqa: E712

        courses = q.all()

        # Which ones are already enrolled?
        enrolled_course_ids = {
            e.course_id
            for e in db.query(Enrollment).filter(Enrollment.student_id == student.id).all()
        }

        out = []
        for c in courses:
            if not include_closed and not _course_open_for_enrollment(c):
                continue
            out.append({
                "id": c.id,
                "course_code": c.course_code,
                "course_title": c.course_title,
                "lecturer_id": c.lecturer_id,
                "is_open_for_enrollment": c.is_open_for_enrollment,
                "enrollment_open_at": c.enrollment_open_at.isoformat() if c.enrollment_open_at else None,
                "enrollment_close_at": c.enrollment_close_at.isoformat() if c.enrollment_close_at else None,
                "is_effectively_open": _course_open_for_enrollment(c),
                "already_enrolled": c.id in enrolled_course_ids,
            })

        return {"ok": True, "count": len(out), "courses": out}, 200
    finally:
        db.close()

@bp.get("/<course_id>/students")
def course_students(course_id: str):
    """
    Lecturer views enrolled students for a course.

    GET /courses/<course_id>/students?lecturer_id=...

    Returns:
    {
      "ok": true,
      "count": 2,
      "students": [
        {"id":"...", "full_name":"...", "identifier":"...", "department":"...", "enrolled_at":"..."}
      ]
    }
    """
    lecturer_id = str(request.args.get("lecturer_id") or "").strip()
    if not lecturer_id:
        return _json_error("Missing query param: lecturer_id", 400)

    db = SessionLocal()
    try:
        lecturer = _get_user(db, lecturer_id)
        if not lecturer:
            return _json_error("Lecturer not found", 404)
        if lecturer.role != "lecturer":
            return _json_error("Only lecturers can view enrolled students", 403)

        course = db.query(Course).filter(Course.id == course_id).first()
        if not course:
            return _json_error("Course not found", 404)

        # Security: lecturer can only view students for their own course
        if course.lecturer_id != lecturer.id:
            return _json_error("You do not own this course", 403)

        enrollments = db.query(Enrollment).filter(Enrollment.course_id == course.id).all()
        student_ids = [e.student_id for e in enrollments]

        students = []
        if student_ids:
            students = db.query(User).filter(User.id.in_(student_ids)).all()

        enrolled_at_map = {e.student_id: e.enrolled_at.isoformat() for e in enrollments}

        out = []
        for s in students:
            out.append({
                "id": s.id,
                "full_name": s.full_name,
                "identifier": s.identifier,
                "department": s.department,
                "enrolled_at": enrolled_at_map.get(s.id),
            })

        return {"ok": True, "count": len(out), "students": out}, 200

    except Exception as e:
        db.rollback()
        return _json_error(f"Fetch students failed: {str(e)}", 500)
    finally:
        db.close()
