import os
from sqlalchemy import create_engine, Column, Integer, String, Float, Text, Boolean, DateTime, Time, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from passlib.context import CryptContext
from datetime import datetime

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./test.db") 
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
    
    # Real Google Timings & Heuristic Windows
    active_from = Column(Time, nullable=True)
    active_to = Column(Time, nullable=True)
    
    # Crowdsourcing Logic
    expires_at = Column(DateTime, nullable=True)
    source = Column(String, default="Admin") 

class IncidentReport(Base):
    __tablename__ = "incident_reports"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String)
    lat = Column(Float)
    lng = Column(Float)
    reported_at = Column(DateTime, default=datetime.utcnow)


# --- AUTOMATIC SCHEMA MIGRATION LOGIC ---
# This forces PostgreSQL to add the missing columns to existing tables
def migrate_schema():
    with engine.connect() as conn:
        try:
            # Fixes for the Places table
            conn.execute(text("ALTER TABLE places ADD COLUMN IF NOT EXISTS lat FLOAT;"))
            conn.execute(text("ALTER TABLE places ADD COLUMN IF NOT EXISTS lng FLOAT;"))
            
            # Fixes for the SafeZones table (THIS FIXES YOUR VERCEL ERROR)
            conn.execute(text("ALTER TABLE safe_zones ADD COLUMN IF NOT EXISTS active_from TIME;"))
            conn.execute(text("ALTER TABLE safe_zones ADD COLUMN IF NOT EXISTS active_to TIME;"))
            conn.execute(text("ALTER TABLE safe_zones ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;"))
            conn.execute(text("ALTER TABLE safe_zones ADD COLUMN IF NOT EXISTS source VARCHAR DEFAULT 'Admin';"))
            
            conn.commit()
            print("Database migration successful. All new columns added.")
        except Exception as e:
            print(f"Migration error (this is okay if using SQLite locally): {e}")

# 1. Run the column adder


# 2. Create tables if they don't exist at all (like the new incident_reports table)
Base.metadata.create_all(bind=engine)