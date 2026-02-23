import os
from datetime import datetime
from flask import Blueprint, jsonify, request, send_file

from database.session import SessionLocal
from database.models import Course, Session as ClassSession, Attendance, User, Enrollment, AttendanceDispute
from utils.reporting import save_csv, pdf_simple_table, utc_now_str

reports_bp = Blueprint("reports", __name__, url_prefix="/reports")


def _db():
    return SessionLocal()


def _exports_dir():
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, "exports")


def _as_iso(dt):
    if not dt:
        return None
    if isinstance(dt, str):
        return dt
    return dt.isoformat()


def _parse_date(s: str):
    # accept YYYY-MM-DD
    return datetime.strptime(s, "%Y-%m-%d")


# -----------------------------
# 1) Attendance records for a session (JSON)
# -----------------------------
@reports_bp.get("/session/<session_id>/json")
def session_report_json(session_id):
    db = _db()
    try:
        sess = db.query(ClassSession).filter_by(id=session_id).first()
        if not sess:
            return jsonify(ok=False, error="Session not found"), 404

        course = db.query(Course).filter_by(id=sess.course_id).first()
        lecturer = db.query(User).filter_by(id=sess.lecturer_id).first()

        q = db.query(Attendance).filter_by(session_id=session_id).order_by(Attendance.timestamp.asc()).all()

        rows = []
        for a in q:
            stu = db.query(User).filter_by(id=a.student_id).first()
            rows.append({
                "attendance_id": a.id,
                "student_id": a.student_id,
                "student_identifier": getattr(stu, "identifier", None),
                "student_name": (f"{stu.first_name} {stu.last_name}" if stu else None),
                "course_id": sess.course_id,
                "course_code": getattr(course, "course_code", None),
                "course_title": getattr(course, "course_title", None),
                "session_id": session_id,
                "method": a.method,
                "status": a.status,
                "confidence": a.confidence,
                "timestamp": _as_iso(a.timestamp),
            })

        return jsonify(ok=True, count=len(rows), meta={
            "session_id": session_id,
            "course_id": sess.course_id,
            "course_code": getattr(course, "course_code", None),
            "course_title": getattr(course, "course_title", None),
            "lecturer_id": sess.lecturer_id,
            "lecturer_name": (f"{lecturer.first_name} {lecturer.last_name}" if lecturer else None),
            "start_time": _as_iso(sess.start_time),
            "end_time": _as_iso(sess.end_time),
            "status": sess.status,
        }, records=rows)
    finally:
        db.close()


# -----------------------------
# 2) Export session attendance (CSV)
# -----------------------------
@reports_bp.get("/session/<session_id>/export/csv")
def session_export_csv(session_id):
    data = session_report_json(session_id).get_json()
    if not data.get("ok"):
        return jsonify(**data), 404

    meta = data["meta"]
    rows = data["records"]

    fname = f"attendance_session_{session_id}_{utc_now_str()}.csv"
    out_path = os.path.join(_exports_dir(), "csv", fname)

    fieldnames = [
        "attendance_id",
        "student_id",
        "student_identifier",
        "student_name",
        "course_code",
        "course_title",
        "session_id",
        "method",
        "status",
        "confidence",
        "timestamp",
    ]

    save_csv(rows, out_path, fieldnames=fieldnames)
    return send_file(out_path, as_attachment=True, download_name=fname)


# -----------------------------
# 3) Export session attendance (PDF)
# -----------------------------
@reports_bp.get("/session/<session_id>/export/pdf")
def session_export_pdf(session_id):
    data = session_report_json(session_id).get_json()
    if not data.get("ok"):
        return jsonify(**data), 404

    meta = data["meta"]
    rows = data["records"]

    fname = f"attendance_session_{session_id}_{utc_now_str()}.pdf"
    out_path = os.path.join(_exports_dir(), "pdf", fname)

    title = f"Attendance Report"
    subtitle = f"{meta.get('course_code')} - {meta.get('course_title')} | Session: {session_id[:8]}... | {meta.get('start_time')}"
    columns = [
        ("student_identifier", "Matric/ID"),
        ("student_name", "Student"),
        ("status", "Status"),
        ("method", "Method"),
        ("timestamp", "Time"),
    ]

    pdf_simple_table(title, subtitle, rows, columns, out_path)
    return send_file(out_path, as_attachment=True, download_name=fname)


# -----------------------------
# 4) Course summary (sessions + counts) JSON
# -----------------------------
@reports_bp.get("/course/<course_id>/summary/json")
def course_summary_json(course_id):
    db = _db()
    try:
        course = db.query(Course).filter_by(id=course_id).first()
        if not course:
            return jsonify(ok=False, error="Course not found"), 404

        enrolled_count = db.query(Enrollment).filter_by(course_id=course_id).count()
        sessions = db.query(ClassSession).filter_by(course_id=course_id).order_by(ClassSession.start_time.desc()).all()

        out = []
        for s in sessions:
            total = db.query(Attendance).filter_by(session_id=s.id).count()
            rate = 0.0
            if enrolled_count > 0:
                rate = round((total / enrolled_count) * 100.0, 2)
            out.append({
                "session_id": s.id,
                "status": s.status,
                "start_time": _as_iso(s.start_time),
                "end_time": _as_iso(s.end_time),
                "marked_count": total,
                "enrolled_count": enrolled_count,
                "attendance_rate": rate,
            })

        return jsonify(ok=True, course={
            "id": course.id,
            "course_code": course.course_code,
            "course_title": course.course_title,
            "is_open_for_enrollment": course.is_open_for_enrollment,
            "created_at": _as_iso(course.created_at),
            "enrolled_count": enrolled_count,
        }, count=len(out), sessions=out)
    finally:
        db.close()


# -----------------------------
# 5) Course summary export (CSV)
# -----------------------------
@reports_bp.get("/course/<course_id>/summary/export/csv")
def course_summary_csv(course_id):
    data = course_summary_json(course_id).get_json()
    if not data.get("ok"):
        return jsonify(**data), 404

    course = data["course"]
    rows = data["sessions"]

    fname = f"course_summary_{course.get('course_code')}_{utc_now_str()}.csv"
    out_path = os.path.join(_exports_dir(), "csv", fname)

    fieldnames = ["session_id", "status", "start_time", "end_time", "marked_count", "enrolled_count", "attendance_rate"]
    save_csv(rows, out_path, fieldnames=fieldnames)
    return send_file(out_path, as_attachment=True, download_name=fname)


# -----------------------------
# 6) Course summary export (PDF)
# -----------------------------
@reports_bp.get("/course/<course_id>/summary/export/pdf")
def course_summary_pdf(course_id):
    data = course_summary_json(course_id).get_json()
    if not data.get("ok"):
        return jsonify(**data), 404

    course = data["course"]
    rows = data["sessions"]

    fname = f"course_summary_{course.get('course_code')}_{utc_now_str()}.pdf"
    out_path = os.path.join(_exports_dir(), "pdf", fname)

    title = "Course Attendance Summary"
    subtitle = f"{course.get('course_code')} - {course.get('course_title')}"
    columns = [
        ("session_id", "Session ID"),
        ("status", "Status"),
        ("start_time", "Start"),
        ("end_time", "End"),
        ("marked_count", "Marked"),
        ("enrolled_count", "Enrolled"),
        ("attendance_rate", "Rate"),
    ]

    # shorten session_id in PDF
    slim = []
    for r in rows:
        rr = dict(r)
        rr["session_id"] = (rr["session_id"][:8] + "...") if rr.get("session_id") else ""
        slim.append(rr)

    pdf_simple_table(title, subtitle, slim, columns, out_path)
    return send_file(out_path, as_attachment=True, download_name=fname)


# -----------------------------
# 7) Student attendance history (JSON)
# -----------------------------
@reports_bp.get("/student/<student_id>/history/json")
def student_history_json(student_id):
    db = _db()
    try:
        stu = db.query(User).filter_by(id=student_id).first()
        if not stu:
            return jsonify(ok=False, error="Student not found"), 404

        q = (
            db.query(Attendance)
            .filter_by(student_id=student_id)
            .order_by(Attendance.timestamp.desc())
            .all()
        )

        rows = []
        for a in q:
            sess = db.query(ClassSession).filter_by(id=a.session_id).first()
            course = db.query(Course).filter_by(id=getattr(sess, "course_id", None)).first()
            rows.append({
                "attendance_id": a.id,
                "course_code": getattr(course, "course_code", None),
                "course_title": getattr(course, "course_title", None),
                "session_id": a.session_id,
                "status": a.status,
                "method": a.method,
                "confidence": a.confidence,
                "timestamp": _as_iso(a.timestamp),
            })

        return jsonify(ok=True, student={
            "id": stu.id,
            "identifier": stu.identifier,
            "name": f"{stu.first_name} {stu.last_name}",
            "department": stu.department,
        }, count=len(rows), records=rows)
    finally:
        db.close()


# -----------------------------
# 8) Course students summary (JSON)
# -----------------------------
@reports_bp.get("/course/<course_id>/students/summary/json")
def course_students_summary_json(course_id):
    include_sessions = str(request.args.get("include_sessions") or "0").strip() == "1"
    db = _db()
    try:
        course = db.query(Course).filter_by(id=course_id).first()
        if not course:
            return jsonify(ok=False, error="Course not found"), 404

        sessions = (
            db.query(ClassSession)
            .filter_by(course_id=course_id)
            .order_by(ClassSession.start_time.asc())
            .all()
        )
        session_ids = [s.id for s in sessions]
        total_sessions = len(session_ids)

        enrollments = db.query(Enrollment).filter_by(course_id=course_id).all()
        student_ids = [e.student_id for e in enrollments]

        students = []
        if student_ids:
            students = db.query(User).filter(User.id.in_(student_ids)).all()

        # Attendance map: student_id -> set(session_id)
        attendance_map = {sid: set() for sid in student_ids}
        if session_ids:
            rows = db.query(Attendance).filter(Attendance.session_id.in_(session_ids)).all()
            for r in rows:
                attendance_map.setdefault(r.student_id, set()).add(r.session_id)

        out = []
        for s in students:
            attended_ids = attendance_map.get(s.id, set())
            attended_count = len(attended_ids)
            missed_count = max(0, total_sessions - attended_count)
            percent = (attended_count / total_sessions * 100.0) if total_sessions > 0 else 0.0

            row = {
                "student_id": s.id,
                "student_identifier": s.identifier,
                "student_name": s.full_name,
                "department": s.department,
                "total_sessions": total_sessions,
                "attended": attended_count,
                "missed": missed_count,
                "percentage": round(percent, 2),
            }
            if include_sessions:
                missed_ids = [sid for sid in session_ids if sid not in attended_ids]
                row["attended_session_ids"] = list(attended_ids)
                row["missed_session_ids"] = missed_ids
            out.append(row)

        return jsonify(
            ok=True,
            course={
                "id": course.id,
                "course_code": course.course_code,
                "course_title": course.course_title,
            },
            total_sessions=total_sessions,
            total_students=len(out),
            students=out,
        )
    finally:
        db.close()


# -----------------------------
# 9) Course students summary (CSV)
# -----------------------------
@reports_bp.get("/course/<course_id>/students/summary/export/csv")
def course_students_summary_csv(course_id):
    data = course_students_summary_json(course_id).get_json()
    if not data.get("ok"):
        return jsonify(**data), 404

    course = data["course"]
    rows = data["students"]

    fname = f"course_students_summary_{course.get('course_code')}_{utc_now_str()}.csv"
    out_path = os.path.join(_exports_dir(), "csv", fname)

    fieldnames = [
        "student_id",
        "student_identifier",
        "student_name",
        "department",
        "total_sessions",
        "attended",
        "missed",
        "percentage",
    ]

    save_csv(rows, out_path, fieldnames=fieldnames)
    return send_file(out_path, as_attachment=True, download_name=fname)


# -----------------------------
# 10) Student summary across courses (JSON)
# -----------------------------
@reports_bp.get("/student/<student_id>/summary/json")
def student_summary_json(student_id):
    include_sessions = str(request.args.get("include_sessions") or "0").strip() == "1"
    db = _db()
    try:
        stu = db.query(User).filter_by(id=student_id).first()
        if not stu:
            return jsonify(ok=False, error="Student not found"), 404

        enrollments = db.query(Enrollment).filter_by(student_id=student_id).all()
        course_ids = [e.course_id for e in enrollments]
        courses = []
        if course_ids:
            courses = db.query(Course).filter(Course.id.in_(course_ids)).all()

        # Sessions for all courses
        sessions = []
        if course_ids:
            sessions = db.query(ClassSession).filter(ClassSession.course_id.in_(course_ids)).all()

        session_ids = [s.id for s in sessions]
        total_sessions = len(session_ids)

        attendance_ids = set()
        if session_ids:
            rows = (
                db.query(Attendance)
                .filter(Attendance.student_id == student_id)
                .filter(Attendance.session_id.in_(session_ids))
                .all()
            )
            attendance_ids = {r.session_id for r in rows}

        # Per-course breakdown
        course_map = {c.id: c for c in courses}
        course_sessions = {}
        for s in sessions:
            course_sessions.setdefault(s.course_id, []).append(s.id)

        per_course = []
        for cid, sess_ids in course_sessions.items():
            attended = len([sid for sid in sess_ids if sid in attendance_ids])
            missed = max(0, len(sess_ids) - attended)
            percent = (attended / len(sess_ids) * 100.0) if len(sess_ids) > 0 else 0.0
            row = {
                "course_id": cid,
                "course_code": getattr(course_map.get(cid), "course_code", None),
                "course_title": getattr(course_map.get(cid), "course_title", None),
                "total_sessions": len(sess_ids),
                "attended": attended,
                "missed": missed,
                "percentage": round(percent, 2),
            }
            if include_sessions:
                row["attended_session_ids"] = [sid for sid in sess_ids if sid in attendance_ids]
                row["missed_session_ids"] = [sid for sid in sess_ids if sid not in attendance_ids]
            per_course.append(row)

        overall_attended = len(attendance_ids)
        overall_missed = max(0, total_sessions - overall_attended)
        overall_percent = (overall_attended / total_sessions * 100.0) if total_sessions > 0 else 0.0

        return jsonify(
            ok=True,
            student={
                "id": stu.id,
                "identifier": stu.identifier,
                "name": f"{stu.first_name} {stu.last_name}",
                "department": stu.department,
            },
            overall={
                "total_sessions": total_sessions,
                "attended": overall_attended,
                "missed": overall_missed,
                "percentage": round(overall_percent, 2),
            },
            per_course=per_course,
        )
    finally:
        db.close()


# -----------------------------
# 11) Course analytics (JSON)
# -----------------------------
@reports_bp.get("/course/<course_id>/analytics/json")
def course_analytics_json(course_id):
    lecturer_id = str(request.args.get("lecturer_id") or "").strip()
    db = _db()
    try:
        course = db.query(Course).filter_by(id=course_id).first()
        if not course:
            return jsonify(ok=False, error="Course not found"), 404

        if lecturer_id:
            lecturer = db.query(User).filter_by(id=lecturer_id).first()
            if not lecturer or lecturer.role != "lecturer":
                return jsonify(ok=False, error="Lecturer not found / invalid role"), 403
            if course.lecturer_id != lecturer.id:
                return jsonify(ok=False, error="You do not own this course"), 403

        enrolled_count = db.query(Enrollment).filter_by(course_id=course_id).count()
        sessions = db.query(ClassSession).filter_by(course_id=course_id).all()
        session_ids = [s.id for s in sessions]
        total_sessions = len(session_ids)

        total_marked = 0
        method_counts = {}
        confidences = []

        if session_ids:
            rows = db.query(Attendance).filter(Attendance.session_id.in_(session_ids)).all()
            total_marked = len(rows)
            for r in rows:
                method_counts[r.method] = method_counts.get(r.method, 0) + 1
                if r.confidence is not None:
                    confidences.append(float(r.confidence))

        attendance_rate = 0.0
        if enrolled_count > 0 and total_sessions > 0:
            attendance_rate = round((total_marked / (enrolled_count * total_sessions)) * 100.0, 2)

        avg_conf = round(sum(confidences) / len(confidences), 4) if confidences else None

        # Dispute stats
        disputes = db.query(AttendanceDispute).filter_by(course_id=course_id).all()
        dispute_counts = {"pending": 0, "approved": 0, "rejected": 0}
        for d in disputes:
            if d.status in dispute_counts:
                dispute_counts[d.status] += 1

        return jsonify(
            ok=True,
            course={
                "id": course.id,
                "course_code": course.course_code,
                "course_title": course.course_title,
                "lecturer_id": course.lecturer_id,
            },
            totals={
                "enrolled": enrolled_count,
                "sessions": total_sessions,
                "marked": total_marked,
                "attendance_rate": attendance_rate,
            },
            methods=method_counts,
            average_confidence=avg_conf,
            disputes=dispute_counts,
        )
    finally:
        db.close()
