import hashlib
import os
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from jose import jwt
from datetime import datetime, timedelta
from pydantic import BaseModel

# Importing the updated models from your database.py
from .database import SessionLocal, User, pwd_context, SafeZone, Place

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

# Pydantic Schemas
class UserCreate(BaseModel):
    username: str
    password: str
    passport: str

class LocationUpdate(BaseModel):
    username: str
    lat: float
    lng: float

# Database Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_digital_id(passport: str):
    # Simulating Blockchain ID via SHA-256 hash
    return "DID_" + hashlib.sha256(passport.encode()).hexdigest()[:12].upper()

# --- EXISTING AUTHENTICATION ENDPOINTS ---

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
    
    token = jwt.encode({
        "sub": db_user.username, 
        "is_admin": db_user.is_admin, # Include admin status in token
        "exp": datetime.utcnow() + timedelta(hours=24)
    }, SECRET_KEY, algorithm=ALGORITHM)

    return {
        "access_token": token, 
        "username": db_user.username, 
        "digital_id": db_user.digital_id,
        "is_admin": db_user.is_admin  # Send this to the frontend
    }

@app.post("/api/update-location")
def update_location(loc: LocationUpdate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == loc.username).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    db_user.last_lat, db_user.last_lng = loc.lat, loc.lng
    db.commit()

    # Dynamic Geofencing: Checking against Admin-defined Safe Zones
    zones = db.query(SafeZone).all()
    is_safe = False
    
    for zone in zones:
        distance = ((loc.lat - zone.lat)**2 + (loc.lng - zone.lng)**2)**0.5
        # radius is stored in degrees for simplicity, or convert to meters
        if distance < (zone.radius / 111000): # Rough conversion meters to degrees
            is_safe = True
            break
    
    return {
        "status": "Safe" if is_safe else "Alert: Outside Safe Zone",
        "digital_id": db_user.digital_id
    }

# --- NEW ADMIN & CONTENT ENDPOINTS ---

@app.get("/api/admin/tourists")
def get_all_tourists(db: Session = Depends(get_db)):
    """Allows admin to see all live locations on the admin map."""
    return db.query(User).all()

@app.get("/api/places")
def get_places(db: Session = Depends(get_db)):
    """Public endpoint for Home.js to see destinations added by admin."""
    return db.query(Place).all()

@app.post("/api/admin/places")
def add_place(place: dict, db: Session = Depends(get_db)):
    """Allows admin to add a new place with name, image, and details."""
    new_place = Place(
        name=place['name'],
        city=place['city'],
        img=place['img'],
        details=place['details']
    )
    db.add(new_place)
    db.commit()
    return {"message": "Place Published!"}

@app.get("/api/admin/safe-zones")
def get_safe_zones(db: Session = Depends(get_db)):
    """Returns safe zones for both Admin and Tourist maps."""
    return db.query(SafeZone).all()

@app.post("/api/admin/safe-zones")
def add_safe_zone(zone: dict, db: Session = Depends(get_db)):
    """Allows admin to set geofenced areas."""
    new_zone = SafeZone(
        name=zone['name'],
        lat=zone['lat'],
        lng=zone['lng'],
        radius=zone['radius']
    )
    db.add(new_zone)
    db.commit()
    return {"message": "Safe Zone Created"}