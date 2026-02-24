import os

class Config:
    # Flask
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-me")
    DEBUG = os.getenv("FLASK_DEBUG", "1") == "1"

    # Database
    DB_NAME = os.getenv("DB_NAME", "ignis.db")
    DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DB_NAME}")

    # CORS
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")

    # Lecturer registration gate (optional)
    # If set, lecturers must provide this code during registration.
    LECTURER_ACCESS_CODE = os.getenv("LECTURER_ACCESS_CODE", "")

    # Attendance (defaults; we'll use later)
    COOLDOWN_MINUTES = int(os.getenv("COOLDOWN_MINUTES", "5"))

    # Live attendance (defaults; we'll use later)
    CAMERA_INDEX = int(os.getenv("CAMERA_INDEX", "0"))
    BLUR_THRESHOLD = float(os.getenv("BLUR_THRESHOLD", "80.0"))

    # OpenCV (YuNet detector + SFace recognizer)
    OPENCV_DET_MODEL = os.getenv("OPENCV_DET_MODEL", "models/face_detection_yunet_2023mar.onnx")
    OPENCV_REC_MODEL = os.getenv("OPENCV_REC_MODEL", "models/face_recognition_sface_2021dec.onnx")
    OPENCV_DET_SIZE = int(os.getenv("OPENCV_DET_SIZE", "640"))
    OPENCV_DET_THRESH = float(os.getenv("OPENCV_DET_THRESH", "0.6"))
    OPENCV_NMS_THRESH = float(os.getenv("OPENCV_NMS_THRESH", "0.45"))

    # Liveness (heuristic checks)
    LIVENESS_ENABLED = os.getenv("LIVENESS_ENABLED", "1") == "1"
    LIVENESS_REQUIRED = os.getenv("LIVENESS_REQUIRED", "0") == "1"
    LIVENESS_MIN_SCORE = float(os.getenv("LIVENESS_MIN_SCORE", "0.67"))
    LIVENESS_MIN_FACE_RATIO = float(os.getenv("LIVENESS_MIN_FACE_RATIO", "0.03"))
    LIVENESS_MIN_EYE_DIST_RATIO = float(os.getenv("LIVENESS_MIN_EYE_DIST_RATIO", "0.25"))
    LIVENESS_CHALLENGE_SHIFT = float(os.getenv("LIVENESS_CHALLENGE_SHIFT", "0.08"))

    # Attendance scans: disable liveness by default for large class photos
    LIVENESS_ATTENDANCE_ENABLED = os.getenv("LIVENESS_ATTENDANCE_ENABLED", "0") == "1"
