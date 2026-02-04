import os
from sqlalchemy import create_engine, Column, Integer, String, Float, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from passlib.context import CryptContext
from sqlalchemy import text
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
    # New Field to distinguish user type
    is_admin = Column(Boolean, default=False) 
    digital_id = Column(String, unique=True) 
    last_lat = Column(Float, nullable=True)
    last_lng = Column(Float, nullable=True)

# --- NEW TABLES FOR ADMIN FEATURE ---
class SafeZone(Base):
    __tablename__ = "safe_zones"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    lat = Column(Float)
    lng = Column(Float)
    radius = Column(Float) # In meters

class Place(Base):
    __tablename__ = "places"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    city = Column(String)
    img = Column(String)
    details = Column(Text) # Using Text for longer descriptions
def execute_migrations():
    with engine.connect() as connection:
        # Step 1: Add the is_admin column if it doesn't exist
        # This prevents the app from crashing if the column is already there
        connection.execute(text("""
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
        """))
        
        # Step 2: Set your specific user as Admin
        # Replace 'YourUsername' with your actual username
        connection.execute(text("""
            UPDATE users 
            SET is_admin = true 
            WHERE username = 'YourUsername';
        """))
        
        # Explicitly commit the changes
        connection.commit()
execute_migrations()
# Create all tables (including new ones)
Base.metadata.create_all(bind=engine)