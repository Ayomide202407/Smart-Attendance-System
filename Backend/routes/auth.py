from flask import Blueprint, request
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy.exc import IntegrityError

from database.engine import SessionLocal
from database.models import User
from routes.meta import DEPARTMENTS
from config import Config

bp = Blueprint("auth", __name__, url_prefix="/auth")


def _json_error(message: str, status_code: int = 400):
    return {"ok": False, "error": message}, status_code


@bp.post("/register")
def register():
    """
    POST /auth/register
    Body JSON:
    {
      "first_name": "Ayomide",
      "last_name": "Abilewa",
      "identifier": "EEG/2021/001"  (matric or staff id),
      "role": "student" | "lecturer",
      "department": "Electronic and Electrical Engineering",
      "password": "mypassword"
    }
    """
    data = request.get_json(silent=True) or {}

    required = ["first_name", "last_name", "identifier", "role", "password"]
    for k in required:
        if not (data.get(k) and str(data.get(k)).strip()):
            return _json_error(f"Missing field: {k}", 400)

    role = str(data["role"]).strip().lower()
    if role not in ("student", "lecturer"):
        return _json_error("role must be 'student' or 'lecturer'", 400)

    identifier = str(data["identifier"]).strip()
    department = str(data.get("department") or "").strip()

    if role == "student":
        if not department:
            return _json_error("Missing field: department", 400)
        if department not in DEPARTMENTS:
            return _json_error("department must be one of the approved OAU departments", 400)
    else:
        if Config.LECTURER_ACCESS_CODE:
            code = str(data.get("lecturer_code") or "").strip()
            if not code or code != Config.LECTURER_ACCESS_CODE:
                return _json_error("Invalid lecturer access code", 403)
        if not department:
            department = "Lecturer"

    password_hash = generate_password_hash(str(data["password"]))

    user = User(
        first_name=str(data["first_name"]).strip(),
        last_name=str(data["last_name"]).strip(),
        identifier=identifier,
        role=role,
        department=department,
        password_hash=password_hash,
    )

    db = SessionLocal()
    try:
        db.add(user)
        db.commit()
        db.refresh(user)

        return {
            "ok": True,
            "message": "Registration successful",
            "user": {
                "id": user.id,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "identifier": user.identifier,
                "role": user.role,
                "department": user.department,
            },
        }, 201

    except IntegrityError:
        db.rollback()
        return _json_error("identifier already exists. Use a different identifier.", 409)
    except Exception as e:
        db.rollback()
        return _json_error(f"Registration failed: {str(e)}", 500)
    finally:
        db.close()


@bp.post("/login")
def login():
    """
    POST /auth/login
    Body JSON:
    {
      "identifier": "EEG/2021/001",
      "password": "mypassword"
    }
    """
    data = request.get_json(silent=True) or {}

    identifier = str(data.get("identifier") or "").strip()
    password = str(data.get("password") or "")

    if not identifier or not password:
        return _json_error("identifier and password are required", 400)

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.identifier == identifier).first()
        if not user:
            return _json_error("Invalid credentials", 401)

        if not check_password_hash(user.password_hash, password):
            return _json_error("Invalid credentials", 401)

        # For now: return basic session info (we can add JWT later)
        return {
            "ok": True,
            "message": "Login successful",
            "user": {
                "id": user.id,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "identifier": user.identifier,
                "role": user.role,
                "department": user.department,
            },
        }, 200

    except Exception as e:
        return _json_error(f"Login failed: {str(e)}", 500)
    finally:
        db.close()
