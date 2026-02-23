import uuid
from datetime import datetime

from sqlalchemy import (
    Column,
    String,
    DateTime,
    ForeignKey,
    Float,
    Boolean,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from database.engine import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


# =========================
# USERS
# =========================
class User(Base):
    """
    One table for both students and lecturers.
    role: "student" | "lecturer"
    department: used for course eligibility filtering (department-only model)
    """
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid)

    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)

    identifier = Column(String, unique=True, nullable=False)  # matric no OR staff id
    role = Column(String, nullable=False)  # student | lecturer
    department = Column(String, nullable=False)

    password_hash = Column(String, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Lecturer -> courses
    courses = relationship("Course", back_populates="lecturer", cascade="all, delete-orphan")

    # Student -> enrollments
    enrollments = relationship("Enrollment", back_populates="student", cascade="all, delete-orphan")

    # Student -> embeddings
    face_embeddings = relationship("FaceEmbedding", back_populates="student", cascade="all, delete-orphan")

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"


# =========================
# COURSES
# =========================
class Course(Base):
    """
    Lecturer creates course.
    Departments eligible are stored in CourseDepartment table.
    Enrollment can be opened/closed by lecturer.
    """
    __tablename__ = "courses"

    id = Column(String, primary_key=True, default=generate_uuid)

    course_code = Column(String, unique=True, nullable=False)
    course_title = Column(String, nullable=False)

    lecturer_id = Column(String, ForeignKey("users.id"), nullable=False)

    is_open_for_enrollment = Column(Boolean, default=True)
    enrollment_open_at = Column(DateTime, nullable=True)
    enrollment_close_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    lecturer = relationship("User", back_populates="courses")

    departments = relationship("CourseDepartment", back_populates="course", cascade="all, delete-orphan")

    enrollments = relationship("Enrollment", back_populates="course", cascade="all, delete-orphan")

    sessions = relationship("Session", back_populates="course", cascade="all, delete-orphan")


# =========================
# COURSE DEPARTMENTS
# =========================
class CourseDepartment(Base):
    __tablename__ = "course_departments"

    id = Column(String, primary_key=True, default=generate_uuid)
    course_id = Column(String, ForeignKey("courses.id"), nullable=False)
    department = Column(String, nullable=False)

    course = relationship("Course", back_populates="departments")

    __table_args__ = (
        UniqueConstraint("course_id", "department", name="uq_course_department"),
    )


# =========================
# ENROLLMENTS
# =========================
class Enrollment(Base):
    __tablename__ = "enrollments"

    id = Column(String, primary_key=True, default=generate_uuid)

    student_id = Column(String, ForeignKey("users.id"), nullable=False)
    course_id = Column(String, ForeignKey("courses.id"), nullable=False)

    enrolled_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("User", back_populates="enrollments")
    course = relationship("Course", back_populates="enrollments")

    __table_args__ = (
        UniqueConstraint("student_id", "course_id", name="uq_student_course"),
    )


# =========================
# SESSIONS
# =========================
class Session(Base):
    """
    A lecturer starts a session for a course.
    status: "active" | "ended"
    """
    __tablename__ = "sessions"

    id = Column(String, primary_key=True, default=generate_uuid)

    course_id = Column(String, ForeignKey("courses.id"), nullable=False)
    lecturer_id = Column(String, ForeignKey("users.id"), nullable=False)

    start_time = Column(DateTime, default=datetime.utcnow)
    end_time = Column(DateTime, nullable=True)

    status = Column(String, default="active")  # active | ended

    course = relationship("Course", back_populates="sessions")

    attendance_records = relationship(
        "Attendance", back_populates="session", cascade="all, delete-orphan"
    )


# =========================
# ATTENDANCE
# =========================
class Attendance(Base):
    """
    One row per student per session (DB constraint ensures no duplicates).
    method: "image_upload" | "live_video"
    """
    __tablename__ = "attendance"

    id = Column(String, primary_key=True, default=generate_uuid)

    session_id = Column(String, ForeignKey("sessions.id"), nullable=False)
    student_id = Column(String, ForeignKey("users.id"), nullable=False)

    timestamp = Column(DateTime, default=datetime.utcnow)

    status = Column(String, default="present")
    method = Column(String, nullable=False)  # image_upload | live_video
    confidence = Column(Float, nullable=True)

    session = relationship("Session", back_populates="attendance_records")

    __table_args__ = (
        UniqueConstraint("session_id", "student_id", name="uq_attendance_once"),
    )


# =========================
# ATTENDANCE AUDIT
# =========================
class AttendanceAudit(Base):
    """
    Audit log for manual attendance changes.
    action: "mark" | "unmark"
    """
    __tablename__ = "attendance_audit"

    id = Column(String, primary_key=True, default=generate_uuid)

    session_id = Column(String, ForeignKey("sessions.id"), nullable=False)
    student_id = Column(String, ForeignKey("users.id"), nullable=False)
    lecturer_id = Column(String, ForeignKey("users.id"), nullable=False)

    action = Column(String, nullable=False)  # mark | unmark
    reason = Column(String, nullable=True)

    timestamp = Column(DateTime, default=datetime.utcnow)


# =========================
# ATTENDANCE DISPUTES
# =========================
class AttendanceDispute(Base):
    """
    Student dispute for a session.
    dispute_type: "missing" | "incorrect"
    status: "pending" | "approved" | "rejected"
    """
    __tablename__ = "attendance_disputes"

    id = Column(String, primary_key=True, default=generate_uuid)

    session_id = Column(String, ForeignKey("sessions.id"), nullable=False)
    course_id = Column(String, ForeignKey("courses.id"), nullable=False)
    student_id = Column(String, ForeignKey("users.id"), nullable=False)

    dispute_type = Column(String, nullable=False)
    status = Column(String, default="pending")

    reason = Column(String, nullable=True)
    resolution_note = Column(String, nullable=True)
    resolver_id = Column(String, ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    __table_args__ = (
        UniqueConstraint("session_id", "student_id", "status", name="uq_dispute_session_student_status"),
    )


# =========================
# FACE EMBEDDINGS (metadata only)
# =========================
class FaceEmbedding(Base):
    """
    Store embedding metadata in DB; actual vectors stored in filesystem (.npy).
    view_type: "front" | "left" | "right"
    """
    __tablename__ = "face_embeddings"

    id = Column(String, primary_key=True, default=generate_uuid)

    student_id = Column(String, ForeignKey("users.id"), nullable=False)

    view_type = Column(String, nullable=False)  # front | left | right
    embedding_path = Column(String, nullable=False)

    model_name = Column(String, default="unknown")
    created_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("User", back_populates="face_embeddings")

    __table_args__ = (
        UniqueConstraint("student_id", "view_type", name="uq_student_viewtype"),
    )
