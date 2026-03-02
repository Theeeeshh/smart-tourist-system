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
class SafeZone(Base):
    __tablename__ = "safe_zones"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    lat = Column(Float)
    lng = Column(Float)
    radius = Column(Float)
    # New column to classify the zone
    category = Column(String, default="Safe") # "Safe", "Danger", "High Danger"

def run_migrations():
    with engine.connect() as connection:
        connection.execute(text("ALTER TABLE safe_zones ADD COLUMN category VARCHAR DEFAULT 'Safe';"))
        
        connection.commit()

run_migrations()
Base.metadata.create_all(bind=engine)