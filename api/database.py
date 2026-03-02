import os
from sqlalchemy import create_engine, Column, Integer, String, Float, Text, Boolean, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from passlib.context import CryptContext

DATABASE_URL = os.environ.get("DATABASE_URL")
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_admin = Column(Boolean, default=False) 
    digital_id = Column(String, unique=True) 
    last_lat = Column(Float, nullable=True)
    last_lng = Column(Float, nullable=True)

class Place(Base):
    __tablename__ = "places"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    city = Column(String)
    img = Column(String)
    details = Column(Text)
    # Ensure these are in the model so SQLAlchemy recognizes them
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)

class SafeZone(Base):
    __tablename__ = "safe_zones"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    lat = Column(Float)
    lng = Column(Float)
    radius = Column(Float)
    category = Column(String, default="Safe") 

# --- SCHEMA MIGRATION LOGIC ---
# This runs BEFORE create_all to ensure the table is ready
def migrate_schema():
    with engine.connect() as conn:
        try:
            # Check if columns exist; if not, add them
            conn.execute(text("ALTER TABLE places ADD COLUMN IF NOT EXISTS lat FLOAT;"))
            conn.execute(text("ALTER TABLE places ADD COLUMN IF NOT EXISTS lng FLOAT;"))
            conn.commit()
            print("Successfully verified/added lat/lng columns to 'places' table.")
        except Exception as e:
            print(f"Migration Note: {e}")

# Execute the migration
migrate_schema()

# Now bind the engine and create any missing tables
Base.metadata.create_all(bind=engine)