from datetime import datetime
from flask import Blueprint, request
from sqlalchemy.exc import IntegrityError

from database.engine import SessionLocal
from database.models import User, Course, CourseDepartment, Enrollment, FaceEmbedding

bp = Blueprint("enrollments", __name__, url_prefix="/enrollments")


def _json_error(message: str, status_code: int = 400):
    return {"ok": False, "error": message}, status_code


def _get_user(db, user_id: str):
    if not user_id:
        return None
    return db.query(User).filter(User.id == user_id).first()


def _has_completed_face_setup(db, student_id: str) -> bool:
    """
    Student must have all 3 required views before enrolling:
    front + left + right
    """
    rows = db.query(FaceEmbedding).filter(FaceEmbedding.student_id == student_id).all()
    views = {r.view_type for r in rows}
    return {"front", "left", "right"}.issubset(views)

def _course_open_for_enrollment(course: Course) -> bool:
    if not course.is_open_for_enrollment:
        return False
    now = datetime.utcnow()
    if course.enrollment_open_at and now < course.enrollment_open_at:
        return False
    if course.enrollment_close_at and now > course.enrollment_close_at:
        return False
    return True

@bp.post("/enroll")
def enroll():
    """
    Student enrolls in a course (self-enroll).

    POST /enrollments/enroll
    Body JSON:
    {
      "student_id": "...",
      "course_id": "..."
    }

    Rules:
    - student must exist and role == student
    - student must have completed face setup (front/left/right)
    - course must exist
    - course must be open for enrollment
    - student's department must be allowed for that course
    - cannot enroll twice (UniqueConstraint)
    """
    data = request.get_json(silent=True) or {}
    student_id = str(data.get("student_id") or "").strip()
    course_id = str(data.get("course_id") or "").strip()

    if not student_id:
        return _json_error("Missing field: student_id", 400)
    if not course_id:
        return _json_error("Missing field: course_id", 400)

    db = SessionLocal()
    try:
        student = _get_user(db, student_id)
        if not student:
            return _json_error("Student not found", 404)
        if student.role != "student":
            return _json_error("User is not a student", 400)

        # OK FACE SETUP ENFORCEMENT (COMPULSORY)
        if not _has_completed_face_setup(db, student.id):
            return _json_error(
                "Face setup incomplete. Upload front/left/right images before enrolling.",
                403,
            )

        course = db.query(Course).filter(Course.id == course_id).first()
        if not course:
            return _json_error("Course not found", 404)

        if not _course_open_for_enrollment(course):
            return _json_error("Enrollment is closed for this course", 403)

        # Check department eligibility
        allowed = (
            db.query(CourseDepartment)
            .filter(CourseDepartment.course_id == course.id)
            .filter(CourseDepartment.department == student.department)
            .first()
        )
        if not allowed:
            return _json_error("You are not eligible for this course (department mismatch)", 403)

        enrollment = Enrollment(student_id=student.id, course_id=course.id)
        db.add(enrollment)
        db.commit()
        db.refresh(enrollment)

        return {
            "ok": True,
            "message": "Enrolled successfully",
            "enrollment": {
                "id": enrollment.id,
                "student_id": enrollment.student_id,
                "course_id": enrollment.course_id,
                "enrolled_at": enrollment.enrolled_at.isoformat(),
            },
        }, 201

    except IntegrityError:
        db.rollback()
        return _json_error("You are already enrolled in this course", 409)
    except Exception as e:
        db.rollback()
        return _json_error(f"Enrollment failed: {str(e)}", 500)
    finally:
        db.close()


@bp.post("/bulk")
def bulk_enroll():
    """
    Lecturer bulk-enrolls students by identifier.

    POST /enrollments/bulk
    Body JSON:
    {
      "lecturer_id": "...",
      "course_id": "...",
      "identifiers": ["EEG/2021/001", "EEE/2022/004"],
      "allow_closed": false,
      "skip_face_check": false
    }
    """
    data = request.get_json(silent=True) or {}
    lecturer_id = str(data.get("lecturer_id") or "").strip()
    course_id = str(data.get("course_id") or "").strip()
    identifiers = data.get("identifiers") or []
    allow_closed = bool(data.get("allow_closed", False))
    skip_face_check = bool(data.get("skip_face_check", False))

    if not lecturer_id:
        return _json_error("Missing field: lecturer_id", 400)
    if not course_id:
        return _json_error("Missing field: course_id", 400)
    if not isinstance(identifiers, list) or len(identifiers) == 0:
        return _json_error("identifiers must be a non-empty list", 400)

    # Normalize identifiers
    cleaned = []
    seen = set()
    for raw in identifiers:
        s = str(raw).strip()
        if not s:
            continue
        key = s.lower()
        if key in seen:
            continue
        seen.add(key)
        cleaned.append(s)

    if len(cleaned) == 0:
        return _json_error("identifiers must contain at least one valid identifier", 400)

    db = SessionLocal()
    try:
        lecturer = _get_user(db, lecturer_id)
        if not lecturer:
            return _json_error("Lecturer not found", 404)
        if lecturer.role != "lecturer":
            return _json_error("Only lecturers can bulk-enroll", 403)

        course = db.query(Course).filter(Course.id == course_id).first()
        if not course:
            return _json_error("Course not found", 404)
        if course.lecturer_id != lecturer.id:
            return _json_error("You do not own this course", 403)
        if not allow_closed and not _course_open_for_enrollment(course):
            return _json_error("Enrollment is closed for this course", 403)

        allowed_depts = {d.department for d in course.departments}

        results = []
        success = 0

        for ident in cleaned:
            student = db.query(User).filter(User.identifier == ident).first()
            if not student:
                results.append({"identifier": ident, "ok": False, "error": "Student not found"})
                continue
            if student.role != "student":
                results.append({"identifier": ident, "ok": False, "error": "User is not a student"})
                continue
            if student.department not in allowed_depts:
                results.append({"identifier": ident, "ok": False, "error": "Department mismatch"})
                continue
            if not skip_face_check and not _has_completed_face_setup(db, student.id):
                results.append({"identifier": ident, "ok": False, "error": "Face setup incomplete"})
                continue
            exists = (
                db.query(Enrollment)
                .filter(Enrollment.student_id == student.id)
                .filter(Enrollment.course_id == course.id)
                .first()
            )
            if exists:
                results.append({"identifier": ident, "ok": False, "error": "Already enrolled"})
                continue

            enrollment = Enrollment(student_id=student.id, course_id=course.id)
            db.add(enrollment)
            results.append({"identifier": ident, "ok": True, "student_id": student.id})
            success += 1

        db.commit()

        failed = len([r for r in results if not r.get("ok")])
        return {
            "ok": True,
            "message": "Bulk enrollment completed",
            "course_id": course.id,
            "success": success,
            "failed": failed,
            "results": results,
        }, 200

    except Exception as e:
        db.rollback()
        return _json_error(f"Bulk enroll failed: {str(e)}", 500)
    finally:
        db.close()


@bp.post("/unenroll")
def unenroll():
    """
    Student unenrolls.

    POST /enrollments/unenroll
    Body JSON:
    {
      "student_id": "...",
      "course_id": "..."
    }
    """
    data = request.get_json(silent=True) or {}
    student_id = str(data.get("student_id") or "").strip()
    course_id = str(data.get("course_id") or "").strip()

    if not student_id:
        return _json_error("Missing field: student_id", 400)
    if not course_id:
        return _json_error("Missing field: course_id", 400)

    db = SessionLocal()
    try:
        student = _get_user(db, student_id)
        if not student:
            return _json_error("Student not found", 404)
        if student.role != "student":
            return _json_error("User is not a student", 400)

        enrollment = (
            db.query(Enrollment)
            .filter(Enrollment.student_id == student.id)
            .filter(Enrollment.course_id == course_id)
            .first()
        )
        if not enrollment:
            return _json_error("Enrollment not found", 404)

        db.delete(enrollment)
        db.commit()

        return {"ok": True, "message": "Unenrolled successfully"}, 200
    except Exception as e:
        db.rollback()
        return _json_error(f"Unenroll failed: {str(e)}", 500)
    finally:
        db.close()


@bp.get("/my/<student_id>")
def my_courses(student_id: str):
    """
    GET /enrollments/my/<student_id>
    Lists courses the student is enrolled in.
    """
    db = SessionLocal()
    try:
        student = _get_user(db, student_id)
        if not student:
            return _json_error("Student not found", 404)
        if student.role != "student":
            return _json_error("User is not a student", 400)

        enrollments = (
            db.query(Enrollment)
            .filter(Enrollment.student_id == student.id)
            .all()
        )

        course_ids = [e.course_id for e in enrollments]
        courses = []
        if course_ids:
            courses = db.query(Course).filter(Course.id.in_(course_ids)).all()

        course_map = {c.id: c for c in courses}

        out = []
        for e in enrollments:
            c = course_map.get(e.course_id)
            if not c:
                continue
            out.append({
                "course_id": c.id,
                "course_code": c.course_code,
                "course_title": c.course_title,
                "lecturer_id": c.lecturer_id,
                "is_open_for_enrollment": c.is_open_for_enrollment,
                "enrollment_open_at": c.enrollment_open_at.isoformat() if c.enrollment_open_at else None,
                "enrollment_close_at": c.enrollment_close_at.isoformat() if c.enrollment_close_at else None,
                "is_effectively_open": _course_open_for_enrollment(c),
                "enrolled_at": e.enrolled_at.isoformat(),
            })

        return {"ok": True, "count": len(out), "courses": out}, 200
    finally:
        db.close()


@bp.get("/available/<student_id>")
def available_courses(student_id: str):
    """
    GET /enrollments/available/<student_id>?include_closed=0|1

    Returns courses the student is eligible for BUT NOT YET ENROLLED in.
    """
    include_closed = str(request.args.get("include_closed") or "0").strip() == "1"

    db = SessionLocal()
    try:
        student = _get_user(db, student_id)
        if not student:
            return _json_error("Student not found", 404)
        if student.role != "student":
            return _json_error("User is not a student", 400)

        q = (
            db.query(Course)
            .join(CourseDepartment, CourseDepartment.course_id == Course.id)
            .filter(CourseDepartment.department == student.department)
        )
        if not include_closed:
            q = q.filter(Course.is_open_for_enrollment == True)  # noqa: E712

        eligible = q.all()

        enrolled_ids = {
            e.course_id
            for e in db.query(Enrollment).filter(Enrollment.student_id == student.id).all()
        }

        out = []
        for c in eligible:
            if c.id in enrolled_ids:
                continue
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
            })

        return {"ok": True, "count": len(out), "courses": out}, 200
    finally:
        db.close()
