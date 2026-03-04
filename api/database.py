import os
from sqlalchemy import create_engine, Column, Integer, String, Float, Text, Boolean, DateTime, Time
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

Base.metadata.create_all(bind=engine)