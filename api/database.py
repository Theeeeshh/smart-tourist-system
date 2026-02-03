import os
from sqlalchemy import create_engine, Column, Integer, String, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from passlib.context import CryptContext

# Fix for SQLAlchemy compatibility with Vercel's 'postgres://' prefix
raw_url = os.getenv("POSTGRES_URL", "postgresql://user:pass@localhost/tourist_db")
if raw_url and raw_url.startswith("postgres://"):
    DATABASE_URL = raw_url.replace("postgres://", "postgresql://", 1)
else:
    DATABASE_URL = raw_url

# Use pool_pre_ping to manage serverless connection recycling
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    # Blockchain-based Digital ID
    digital_id = Column(String, unique=True) 
    last_lat = Column(Float, nullable=True)
    last_lng = Column(Float, nullable=True)

# Create tables in the Vercel Postgres instance
Base.metadata.create_all(bind=engine)