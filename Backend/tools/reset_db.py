import os

from database.engine import engine, Base
from config import Config

# IMPORTANT: ensure models are imported so tables are registered
import database.models  # noqa: F401


def reset_db():
    db_name = Config.DB_NAME
    if db_name and os.path.exists(db_name):
        try:
            os.remove(db_name)
            print(f"Removed existing DB file: {db_name}")
        except Exception as e:
            print(f"Warning: could not remove DB file ({db_name}): {e}")

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    print("Database reset complete.")


if __name__ == "__main__":
    reset_db()
