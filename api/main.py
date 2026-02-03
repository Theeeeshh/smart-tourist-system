import hashlib
import os
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from jose import jwt
from datetime import datetime, timedelta
from pydantic import BaseModel
from .database import SessionLocal, User, pwd_context

app = FastAPI()

# Enable CORS for React frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load secret key from Vercel Environment Variables
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "fallback_dev_key")
ALGORITHM = "HS256"

class UserCreate(BaseModel):
    username: str
    password: str
    passport: str

class LocationUpdate(BaseModel):
    username: str
    lat: float
    lng: float

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_digital_id(passport: str):
    # Simulating Blockchain ID via SHA-256 hash
    return "DID_" + hashlib.sha256(passport.encode()).hexdigest()[:12].upper()

@app.post("/api/signup")
def signup(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    new_user = User(
        username=user.username,
        hashed_password=pwd_context.hash(user.password),
        digital_id=create_digital_id(user.passport)
    )
    db.add(new_user)
    db.commit()
    return {"message": "User created", "digital_id": new_user.digital_id}

@app.post("/api/login")
def login(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == user.username).first()
    if not db_user or not pwd_context.verify(user.password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = jwt.encode({"sub": db_user.username, "exp": datetime.utcnow() + timedelta(hours=24)}, SECRET_KEY, algorithm=ALGORITHM)
    return {"access_token": token, "username": db_user.username, "digital_id": db_user.digital_id}

@app.post("/api/update-location")
def update_location(loc: LocationUpdate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == loc.username).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    db_user.last_lat, db_user.last_lng = loc.lat, loc.lng
    db.commit()

    # Geofencing: Example check for Taj Mahal area
    TAJ_LAT, TAJ_LNG = 27.1751, 78.0421
    distance = ((loc.lat - TAJ_LAT)**2 + (loc.lng - TAJ_LNG)**2)**0.5
    is_safe = distance < 0.01 # Approx 1km radius
    
    return {
        "status": "Safe" if is_safe else "Alert: Outside Safe Zone",
        "digital_id": db_user.digital_id
    }