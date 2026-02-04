import hashlib
import os
import json
import redis
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from jose import jwt
from datetime import datetime, timedelta
from pydantic import BaseModel
from typing import List, Optional

from .database import SessionLocal, User, pwd_context, SafeZone, Place

app = FastAPI()

# --- REDIS CONNECTION SETUP ---
# Detects Vercel KV or Upstash Redis URL
REDIS_URL = os.getenv("KV_URL") or os.getenv("REDIS_URL")

if REDIS_URL:
    r = redis.from_url(REDIS_URL, decode_responses=True)
else:
    # Local fallback for development
    r = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "fallback_dev_key")
ALGORITHM = "HS256"

# Pydantic Schemas - Fixed to prevent 422 errors
class LocationUpdate(BaseModel):
    username: str
    lat: float
    lng: float

class ZoneUpdate(BaseModel):
    name: str
    lat: float
    lng: float
    radius: float

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- REDIS LIVE TRACKING & GEOFENCING ---

@app.post("/api/update-location")
def update_location(loc: LocationUpdate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == loc.username).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Update Redis with 5-minute expiry (300 seconds)
    location_data = {"lat": loc.lat, "lng": loc.lng, "timestamp": datetime.utcnow().isoformat()}
    r.setex(f"live_loc:{loc.username}", 300, json.dumps(location_data))

    # Update PostgreSQL
    db_user.last_lat, db_user.last_lng = loc.lat, loc.lng
    db.commit()

    # Geofencing Check
    zones = db.query(SafeZone).all()
    is_safe = False
    for zone in zones:
        distance = ((loc.lat - zone.lat)**2 + (loc.lng - zone.lng)**2)**0.5
        if distance < (zone.radius / 111000): 
            is_safe = True
            break
    
    return {"status": "Safe" if is_safe else "Alert: Outside Safe Zone", "digital_id": db_user.digital_id}

# --- ADMIN ENDPOINTS (CRUD FOR PLACES & ZONES) ---

@app.get("/api/admin/tourists")
def get_all_tourists(db: Session = Depends(get_db)):
    users = db.query(User).filter(User.is_admin == False).all()
    results = []
    for user in users:
        live_data = r.get(f"live_loc:{user.username}")
        loc = json.loads(live_data) if live_data else None
        results.append({
            "id": user.id, "username": user.username, "digital_id": user.digital_id,
            "last_lat": loc["lat"] if loc else user.last_lat,
            "last_lng": loc["lng"] if loc else user.last_lng,
            "is_online": loc is not None
        })
    return results

@app.delete("/api/admin/tourist-location/{username}")
def delete_live_location(username: str):
    r.delete(f"live_loc:{username}")
    return {"message": "Live trace cleared"}

@app.get("/api/places")
def get_places(db: Session = Depends(get_db)):
    return db.query(Place).all()

@app.post("/api/admin/places")
def add_place(place: dict, db: Session = Depends(get_db)):
    new_place = Place(name=place['name'], city=place['city'], img=place['img'], details=place['details'])
    db.add(new_place)
    db.commit()
    return {"message": "Place Published!"}

@app.put("/api/admin/places/{place_id}")
def update_place(place_id: int, place_data: dict, db: Session = Depends(get_db)):
    db_place = db.query(Place).filter(Place.id == place_id).first()
    if not db_place: raise HTTPException(status_code=404)
    db_place.name, db_place.city = place_data.get('name'), place_data.get('city')
    db_place.img, db_place.details = place_data.get('img'), place_data.get('details')
    db.commit()
    return {"message": "Place updated"}

@app.delete("/api/admin/places/{place_id}")
def delete_place(place_id: int, db: Session = Depends(get_db)):
    db_place = db.query(Place).filter(Place.id == place_id).first()
    if db_place:
        db.delete(db_place)
        db.commit()
    return {"message": "Place deleted"}

# --- SAFE ZONE ENDPOINTS ---
@app.get("/api/admin/safe-zones")
def get_safe_zones(db: Session = Depends(get_db)):
    return db.query(SafeZone).all()

@app.post("/api/admin/safe-zones")
def add_safe_zone(zone: dict, db: Session = Depends(get_db)):
    new_zone = SafeZone(name=zone['name'], lat=zone['lat'], lng=zone['lng'], radius=zone['radius'])
    db.add(new_zone)
    db.commit()
    return {"message": "Safe Zone Created"}

@app.put("/api/admin/safe-zones/{zone_id}")
def update_safe_zone(zone_id: int, zone: ZoneUpdate, db: Session = Depends(get_db)):
    db_zone = db.query(SafeZone).filter(SafeZone.id == zone_id).first()
    if not db_zone: raise HTTPException(status_code=404)
    db_zone.name, db_zone.lat, db_zone.lng, db_zone.radius = zone.name, zone.lat, zone.lng, zone.radius
    db.commit()
    return {"message": "Zone updated"}

@app.delete("/api/admin/safe-zones/{zone_id}")
def delete_safe_zone(zone_id: int, db: Session = Depends(get_db)):
    db_zone = db.query(SafeZone).filter(SafeZone.id == zone_id).first()
    if db_zone:
        db.delete(db_zone)
        db.commit()
    return {"message": "Zone deleted"}