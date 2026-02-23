from flask import Flask
from werkzeug.exceptions import HTTPException
from flask_cors import CORS

from config import Config
from database.engine import engine, Base

# IMPORTANT: ensure models are loaded before create_all
import database.models  # noqa: F401

# Blueprints
from routes.auth import bp as auth_bp
from routes.meta import bp as meta_bp
from routes.courses import bp as courses_bp
from routes.enrollments import bp as enrollments_bp
from routes.sessions import bp as sessions_bp
from routes.attendance import bp as attendance_bp
from routes.embeddings import bp as embeddings_bp
from routes.reports import reports_bp

def create_app() -> Flask:
    app = Flask(__name__)
    app.config["SECRET_KEY"] = Config.SECRET_KEY
    app.config["DEBUG"] = Config.DEBUG

    CORS(
        app,
        resources={r"/*": {"origins": Config.CORS_ORIGINS}},
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization"],
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    )


    # Create tables
    Base.metadata.create_all(bind=engine)

    # Register routes
    app.register_blueprint(auth_bp)
    app.register_blueprint(meta_bp)
    app.register_blueprint(courses_bp)
    app.register_blueprint(enrollments_bp)
    app.register_blueprint(sessions_bp)
    app.register_blueprint(attendance_bp)
    app.register_blueprint(embeddings_bp)
    app.register_blueprint(reports_bp)

    @app.errorhandler(HTTPException)
    def handle_http_exception(err: HTTPException):
        return {"ok": False, "error": err.description}, err.code

    @app.errorhandler(Exception)
    def handle_exception(err: Exception):
        return {"ok": False, "error": "Internal server error"}, 500

    @app.get("/")
    def root():
        return {"message": "Backend running (Batch 9 OK)"}

    @app.get("/health")
    def health():
        return {"status": "ok"}

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=Config.DEBUG)
