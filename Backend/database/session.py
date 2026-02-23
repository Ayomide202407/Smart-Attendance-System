from database.engine import SessionLocal

def get_db():
    """
    Dependency-style DB session generator (works for Flask routes too).
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
