from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash

from database.engine import SessionLocal
from database.models import User, Course, CourseDepartment
from routes.meta import DEPARTMENTS


def seed_demo():
    db = SessionLocal()
    try:
        # Lecturer
        lecturer = User(
            first_name="Ada",
            last_name="Okon",
            identifier="L/0001",
            role="lecturer",
            department="Electronic and Electrical Engineering",
            password_hash=generate_password_hash("password123"),
        )
        db.add(lecturer)
        db.flush()

        # Student
        student = User(
            first_name="Tunde",
            last_name="Adebayo",
            identifier="EEG/2021/001",
            role="student",
            department="Electronic and Electrical Engineering",
            password_hash=generate_password_hash("password123"),
        )
        db.add(student)
        db.flush()

        # Course
        course = Course(
            course_code="EEE451",
            course_title="Final Year Project",
            lecturer_id=lecturer.id,
            is_open_for_enrollment=True,
            enrollment_open_at=datetime.utcnow() - timedelta(days=1),
            enrollment_close_at=datetime.utcnow() + timedelta(days=7),
        )
        db.add(course)
        db.flush()

        # Departments
        allowed = [
            "Electronic and Electrical Engineering",
            "Computer Science and Engineering",
        ]
        allowed = [d for d in allowed if d in DEPARTMENTS]
        for dept in allowed:
            db.add(CourseDepartment(course_id=course.id, department=dept))

        db.commit()
        print("Demo seed complete.")
        print("Lecturer: L/0001  password: password123")
        print("Student:  EEG/2021/001  password: password123")
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo()
