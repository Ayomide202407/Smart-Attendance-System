from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import StaticPool

from config import Config

def _is_sqlite(url: str) -> bool:
    return url.startswith("sqlite:///") or url.startswith("sqlite://")

# Use SQLite-specific options only when SQLite is in use.
if _is_sqlite(Config.DATABASE_URL):
    engine = create_engine(
        Config.DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False,
    )
else:
    engine = create_engine(
        Config.DATABASE_URL,
        echo=False,
    )

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()
