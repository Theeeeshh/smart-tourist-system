import hashlib
import os
import json
import redis
import httpx
import math
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from jose import jwt
from datetime import datetime, timedelta
from pydantic import BaseModel
from typing import List, Optional

# Ensure your database.py contains the User, SafeZone, and Place models
from .database import SessionLocal, User, pwd_context, SafeZone, Place

app = FastAPI()
SAFE_API_URL = "https://test.api.amadeus.com/v1/safety/safety-rated-locations"
# --- REDIS CONNECTION SETUP ---
# Detects Vercel KV or Upstash Redis URL provided by Vercel Environment Variables
REDIS_URL = os.getenv("KV_URL") or os.getenv("REDIS_URL")

if REDIS_URL:
    # Use the remote Vercel/Upstash Redis instance
    r = redis.from_url(REDIS_URL, decode_responses=True)
else:
    # Fallback for local development
    r = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "fallback_dev_key")
ALGORITHM = "HS256"

# --- PYDANTIC SCHEMAS ---
class UserCreate(BaseModel):
    username: str
    password: str
    passport: str

class LocationUpdate(BaseModel):
    username: str
    lat: float
    lng: float

class ZoneUpdate(BaseModel):
    name: str
    lat: float
    lng: float
    radius: float

class PlaceUpdate(BaseModel):
    name: str
    city: str
    img: str
    details: str

# --- DATABASE DEPENDENCY ---
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_digital_id(passport: str):
    """Generates a unique Digital ID based on passport info."""
    return "DID_" + hashlib.sha256(passport.encode()).hexdigest()[:12].upper()

# --- AUTHENTICATION ENDPOINTS ---

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
        "is_admin": db_user.is_admin,
        "exp": datetime.utcnow() + timedelta(hours=24)
    }, SECRET_KEY, algorithm=ALGORITHM)

    return {
        "access_token": token, 
        "username": db_user.username, 
        "digital_id": db_user.digital_id,
        "is_admin": db_user.is_admin 
    }

# --- LIVE LOCATION & GEOFENCING ---
@app.post("/api/update-location")
def update_location(loc: LocationUpdate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == loc.username).first()
    
    # 1. Update user location in DB
    db_user.last_lat, db_user.last_lng = loc.lat, loc.lng
    db.commit()

    # 2. Identify region for Emergency Contacts
    # Simple bounding box for Ooty vs Kerala
    region = "Kerala" if 8.0 < loc.lat < 10.5 else "Ooty" if 11.0 < loc.lat < 11.5 else "Default"

    # 3. Check for Zone Entry/Alerts
    all_zones = db.query(SafeZone).all()
    status_msg = "You are in a monitored area"
    alert_level = "success" # Default green

    for zone in all_zones:
        # Distance calculation (approximate meters)
        distance = math.sqrt((loc.lat - zone.lat)**2 + (loc.lng - zone.lng)**2) * 111000
        if distance <= zone.radius:
            if zone.category == "High Danger":
                status_msg = f"CRITICAL: Entering {zone.name} (High Risk Area!)"
                alert_level = "danger" # Red
            elif zone.category == "Danger":
                status_msg = f"WARNING: {zone.name} is a Danger Zone. Stay alert."
                alert_level = "warning" # Yellow
            else:
                status_msg = f"Safe Zone: {zone.name}"
                alert_level = "success" # Green
            break

    return {
        "status": status_msg,
        "alert_level": alert_level,
        "region": region,
        "contacts": EMERGENCY_CONTACTS.get(region)
    }
# --- ADMIN: TOURIST MANAGEMENT ---

@app.get("/api/admin/tourists")
def get_all_tourists(db: Session = Depends(get_db)):
    """Combines persistent DB data with real-time Redis status."""
    users = db.query(User).filter(User.is_admin == False).all()
    results = []
    for user in users:
        live_data = r.get(f"live_loc:{user.username}")
        loc = json.loads(live_data) if live_data else None
        
        results.append({
            "id": user.id,
            "username": user.username,
            "digital_id": user.digital_id,
            "last_lat": loc["lat"] if loc else user.last_lat,
            "last_lng": loc["lng"] if loc else user.last_lng,
            "is_online": loc is not None
        })
    return results

@app.delete("/api/admin/tourist-location/{username}")
def delete_live_location(username: str):
    """Force clears the Redis trace for a specific user."""
    r.delete(f"live_loc:{username}")
    return {"message": "Live trace cleared"}

# --- ADMIN: SAFE ZONE CRUD ---

@app.get("/api/admin/safe-zones")
def get_safe_zones(db: Session = Depends(get_db)):
    return db.query(SafeZone).all()





@app.delete("/api/admin/safe-zones/{zone_id}")
def delete_safe_zone(zone_id: int, db: Session = Depends(get_db)):
    db_zone = db.query(SafeZone).filter(SafeZone.id == zone_id).first()
    if db_zone:
        db.delete(db_zone)
        db.commit()
    return {"message": "Zone deleted"}

# --- ADMIN: PLACES CRUD ---

@app.get("/api/places")
def get_places(db: Session = Depends(get_db)):
    return db.query(Place).all()

@app.post("/api/admin/places")
async def add_place_with_auto_zones(place: dict, db: Session = Depends(get_db)):
    # 1. Save the primary destination
    new_place = Place(name=place['name'], city=place['city'], img=place['img'], details=place['details'])
    db.add(new_place)
    
    # 2. AUTOMATIC ZONE DISCOVERY
    # We assume you provide Lat/Lng for the place in the request
    lat, lng = place.get('lat'), place.get('lng')
    
    if lat and lng:
        async with httpx.AsyncClient() as client:
            # Fetch real-world safety data for this coordinate
            response = await client.get(f"{SAFE_API_URL}?latitude={lat}&longitude={lng}", headers={"Authorization": f"Bearer {YOUR_TOKEN}"})
            data = response.json()

            for item in data.get('data', []):
                score = item['safetyScores']['overall']
                
                # Determine classification based on score
                if score > 70:
                    zone_name = f"HIGH DANGER: {item['name']}"
                elif score > 40:
                    zone_name = f"Danger: {item['name']}"
                else:
                    zone_name = f"Safe: {item['name']}"
                
                # Add to your SafeZone database automatically
                auto_zone = SafeZone(
                    name=zone_name,
                    lat=item['geoCode']['latitude'],
                    lng=item['geoCode']['longitude'],
                    radius=500 # Default 500m radius
                )
                db.add(auto_zone)
    
    db.commit()
    return {"message": "Place and safety zones automatically added!"}

@app.put("/api/admin/places/{place_id}")
def update_place(place_id: int, place_data: dict, db: Session = Depends(get_db)):
    db_place = db.query(Place).filter(Place.id == place_id).first()
    if not db_place:
        raise HTTPException(status_code=404, detail="Place not found")
    db_place.name = place_data.get('name', db_place.name)
    db_place.city = place_data.get('city', db_place.city)
    db_place.img = place_data.get('img', db_place.img)
    db_place.details = place_data.get('details', db_place.details)
    db.commit()
    return {"message": "Place updated successfully"}

@app.delete("/api/admin/places/{place_id}")
def delete_place(place_id: int, db: Session = Depends(get_db)):
    db_place = db.query(Place).filter(Place.id == place_id).first()
    if db_place:
        db.delete(db_place)
        db.commit()
    return {"message": "Place deleted successfully"}
# --- ADMIN: PERMANENT USER DELETION & TRACE CLEARING ---

@app.delete("/api/admin/users/{user_id}")
def delete_user_permanently(user_id: int, db: Session = Depends(get_db)):
    """Deletes a user from the DB and ensures Redis stops tracking them."""
    # 1. Find the user in PostgreSQL
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # 2. Kill the Redis trace immediately so tracking stops
    r.delete(f"live_loc:{db_user.username}")
    
    # 3. Delete the user from the database
    db.delete(db_user)
    db.commit()
    
    return {"message": f"User {db_user.username} and their location traces were deleted."}