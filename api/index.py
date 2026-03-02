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
HF_SPACE_ID = "sunil0034/rakshasetu-ai-engine" 
HF_API_URL = f"https://{HF_SPACE_ID.replace('/', '-')}.hf.space/gradio_api/call/predict"

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
GOOGLE_SEARCH_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
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
async def add_place_with_remote_ai(place: dict, db: Session = Depends(get_db)):
    # 1. Save the primary Place to PostgreSQL
    new_place = Place(
        name=place['name'], 
        city=place['city'], 
        img=place['img'], 
        details=place['details']
    )
    db.add(new_place)
    db.flush() # Get ID for relationships if needed
    
    lat, lng = place.get('lat'), place.get('lng')
    
    # 2. CALL HUGGING FACE AI ENGINE
    category = "Safe" # Default fallback
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            # Send data to Hugging Face
            # Ensure the order matches your Gradio app.py inputs: [type, rating, fee]
            response = await client.post(HF_API_URL, json={
                "data": [place['type'], float(place['rating']), float(place['fee'])]
            })
            
            if response.status_code == 200:
                event_id = response.json().get("event_id")
                # Gradio uses server-sent events or polling; we poll the result endpoint
                result_url = f"{HF_API_URL}/{event_id}"
                
                # We wait a brief moment for the AI to process
                await asyncio.sleep(0.5) 
                result_res = await client.get(result_url)
                
                # Gradio response parsing (data is typically in a list)
                prediction_data = result_res.json()
                # Note: Adjust index based on your Gradio output
                prediction = prediction_data.get('data', [0])[0] 
                
                categories_map = {0: "Safe", 1: "Danger", 2: "High Danger"}
                category = categories_map.get(int(prediction), "Safe")
    except Exception as e:
        print(f"Hugging Face API Error: {e}")

    # 3. Save the AI-determined Primary Zone
    db.add(SafeZone(
        name=f"AI PROFILE: {place['name']}",
        lat=lat, lng=lng, radius=1000,
        category=category
    ))

    # 4. GOOGLE PLACES: Generate surrounding Safe/Danger/Neutral zones
    if lat and lng and GOOGLE_API_KEY:
        async with httpx.AsyncClient() as client:
            target_types = "police|hospital|liquor_store|night_club|bar|bank"
            g_res = await client.get(
                f"{GOOGLE_SEARCH_URL}?location={lat},{lng}&radius=4000&type={target_types}&key={GOOGLE_API_KEY}"
            )
            
            if g_res.status_code == 200:
                results = g_res.json().get('results', [])
                
                # Logic to add 2-3 of each as requested
                counts = {"Safe": 0, "Danger": 0, "High Danger": 0}
                limit = 3

                for item in results:
                    poi_types = item.get('types', [])
                    poi_name = item['name']
                    
                    if any(t in poi_types for t in ["police", "hospital"]) and counts["Safe"] < limit:
                        cat, rad, prefix = "Safe", 500, "SAFE HUB"
                        counts["Safe"] += 1
                    elif "night_club" in poi_types and counts["High Danger"] < limit:
                        cat, rad, prefix = "High Danger", 300, "CRITICAL"
                        counts["High Danger"] += 1
                    elif any(t in poi_types for t in ["liquor_store", "bar"]) and counts["Danger"] < limit:
                        cat, rad, prefix = "Danger", 400, "CAUTION"
                        counts["Danger"] += 1
                    else:
                        cat, rad, prefix = "Neutral", 450, "ZONE"

                    db.add(SafeZone(
                        name=f"{prefix}: {poi_name}",
                        lat=item['geometry']['location']['lat'],
                        lng=item['geometry']['location']['lng'],
                        radius=rad,
                        category=cat
                    ))

    db.commit()
    return {"message": f"Place added. AI Category: {category}", "zones_added": len(results)}
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