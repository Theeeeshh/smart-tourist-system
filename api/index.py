import hashlib
import os
import json
import redis
import httpx
import math
import joblib
import os
import numpy as np
import httpx
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
    # Using a connection pool is MANDATORY to avoid "Device or resource busy"
    pool = redis.ConnectionPool.from_url(
        REDIS_URL, 
        decode_responses=True,
        socket_connect_timeout=5,  # Give it time to resolve DNS
        socket_timeout=5,          # Don't hang forever
        retry_on_timeout=True
    )
    r = redis.Redis(connection_pool=pool)
else:
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
def get_safety_status(lat, lng, db: Session):
    """
    Scans all zones and returns the highest risk category the user is currently in.
    """
    zones = db.query(SafeZone).all()
    current_status = "Scanning Area..."
    alert_level = "success" # Default Green

    for zone in zones:
        # Distance calculation in meters (approximate)
        # Using 111,000 meters per degree for quick local calculation
        distance = math.sqrt((lat - zone.lat)**2 + (lng - zone.lng)**2) * 111000
        
        if distance <= zone.radius:
            # Check for classification
            if zone.category == "High Danger":
                return f"CRITICAL ALERT: {zone.name} (High Danger Zone)", "danger"
            elif zone.category == "Danger":
                # We don't return immediately so a 'High Danger' check can override this
                current_status = f"WARNING: Entering {zone.name} (Danger Zone)"
                alert_level = "warning"
            elif zone.category == "Safe" and alert_level != "warning":
                current_status = f"Inside Safe Zone: {zone.name}"
                alert_level = "success"

    return current_status, alert_level
async def get_amadeus_token():
    """Fetches a fresh OAuth2 token from Amadeus."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://test.api.amadeus.com/v1/security/oauth2/token",
            data={
                "grant_type": "client_credentials",
                "client_id": os.getenv("AMADEUS_KEY"),
                "client_secret": os.getenv("AMADEUS_SECRET"),
            },
        )
        data = response.json()
        return data.get("access_token")

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
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    # 1. Update User's coordinates in the Database
    db_user.last_lat, db_user.last_lng = loc.lat, loc.lng
    db.commit()

    # 2. Run Geofencing Check
    status, alert_level = get_safety_status(loc.lat, loc.lng, db)

    # Note: Emergency Contacts are NOT returned here because 
    # the frontend handles them via Nominatim API.
    return {
        "status": status,
        "alert_level": alert_level,
        "lat": loc.lat,
        "lng": loc.lng
    }
# --- ADMIN: TOURIST MANAGEMENT ---

@app.get("/api/admin/tourists")
def get_all_tourists(db: Session = Depends(get_db)):
    users = db.query(User).filter(User.is_admin == False).all()
    if not users:
        return []

    # 1. Prepare all keys first
    keys = [f"live_loc:{user.username}" for user in users]
    
    try:
        # 2. Fetch ALL live data in ONE single network call
        live_data_list = r.mget(keys)
    except redis.exceptions.RedisError:
        # Fallback if Redis fails so the page doesn't 500
        live_data_list = [None] * len(users)

    results = []
    # 3. Zip them together for the response
    for user, live_data in zip(users, live_data_list):
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
async def add_place_with_ai_and_google_zones(place: dict, db: Session = Depends(get_db)):
    # 1. Save the main destination
    new_place = Place(
        name=place['name'], 
        city=place['city'], 
        img=place['img'], 
        details=place['details']
    )
    db.add(new_place)
    db.flush() 
    
    lat, lng = place.get('lat'), place.get('lng')
    
    # 2. AI PREDICTION for Center
    primary_category = "Safe" 
    if model and type_encoder:
        try:
            type_idx = type_encoder.transform([place['type']])[0]
            features = np.array([[type_idx, float(place['rating']), float(place['fee'])]])
            prediction = model.predict(features)[0]
            categories_map = {0: "Safe", 1: "Danger", 2: "High Danger"}
            primary_category = categories_map.get(prediction, "Safe")
        except Exception as e:
            print(f"AI Inference Error: {e}")

    db.add(SafeZone(
        name=f"AI PROFILE: {place['name']}",
        lat=lat, lng=lng, radius=1000,
        category=primary_category
    ))

    # 3. GOOGLE PLACES: Balanced Zone Generation
    if lat and lng and GOOGLE_API_KEY:
        async with httpx.AsyncClient() as client:
            target_types = "police|hospital|liquor_store|night_club|bar|park|cafe"
            response = await client.get(
                f"{SEARCH_URL}?location={lat},{lng}&radius=4000&type={target_types}&key={GOOGLE_API_KEY}"
            )
            
            if response.status_code == 200:
                results = response.json().get('results', [])
                
                # Tracking counters to hit your "2-3 zones per category" requirement
                counts = {"Safe": 0, "Danger": 0, "High Danger": 0}
                limit = 3 # Max 3 per specific category, rest become Neutral

                for item in results:
                    poi_types = item.get('types', [])
                    poi_name = item['name']
                    item_lat = item['geometry']['location']['lat']
                    item_lng = item['geometry']['location']['lng']
                    
                    # Logic to determine the "potential" category
                    if any(t in poi_types for t in ["police", "hospital"]) and counts["Safe"] < limit:
                        cat = "Safe"
                        prefix = "SAFE HUB"
                        radius = 500
                        counts["Safe"] += 1
                    elif "night_club" in poi_types and counts["High Danger"] < limit:
                        cat = "High Danger"
                        prefix = "CRITICAL"
                        radius = 300
                        counts["High Danger"] += 1
                    elif any(t in poi_types for t in ["liquor_store", "bar"]) and counts["Danger"] < limit:
                        cat = "Danger"
                        prefix = "CAUTION"
                        radius = 400
                        counts["Danger"] += 1
                    else:
                        # EVERYTHING ELSE MARKED AS NEUTRAL
                        cat = "Neutral"
                        prefix = "ZONE"
                        radius = 450

                    db.add(SafeZone(
                        name=f"{prefix}: {poi_name}",
                        lat=item_lat,
                        lng=item_lng,
                        radius=radius,
                        category=cat
                    ))

    db.commit()
    return {
        "message": f"Place added. AI classified as {primary_category}.",
        "stats": counts
    }

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