"""
Copy this content into your PythonAnywhere WSGI file:
/var/www/<your-username>_pythonanywhere_com_wsgi.py
"""

import os
import sys

# 1) Point this to your project location on PythonAnywhere.
PROJECT_HOME = "/home/<your-username>/EEE451 PROJECT"
BACKEND_DIR = os.path.join(PROJECT_HOME, "Backend")

if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# 2) Optional: set env vars here (or in PythonAnywhere Web tab).
os.environ.setdefault("SECRET_KEY", "change-this-secret")
os.environ.setdefault("FLASK_DEBUG", "0")
os.environ.setdefault("DB_NAME", os.path.join(BACKEND_DIR, "ignis.db"))
os.environ.setdefault("DATABASE_URL", f"sqlite:///{os.environ['DB_NAME']}")
os.environ.setdefault("CORS_ORIGINS", "*")
os.environ.setdefault("CORS_SUPPORTS_CREDENTIALS", "0")

# 3) Import Flask app object from Backend/app.py
from app import app as application  # noqa: E402

