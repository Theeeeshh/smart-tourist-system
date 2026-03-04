import hashlib
import os
import json
import redis
import httpx
import math
import asyncio
import pytz
from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from jose import jwt
from datetime import datetime, timedelta, time as dt_time
from pydantic import BaseModel

from .database import SessionLocal, User, pwd_context, SafeZone, Place, IncidentReport

app = FastAPI()

# --- EXTERNAL API CONFIGURATION ---
HF_API_URL = "https://sunil0034-rakshasetu-ai-engine.hf.space/gradio_api/call/predict"
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
# FIX 1: Explicitly defining the Google URL here so it is never missing
GOOGLE_SEARCH_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json" 

# --- REDIS SETUP FOR SERVERLESS (VERCEL) ---
REDIS_URL = os.getenv("KV_URL") or os.getenv("REDIS_URL")
if REDIS_URL:
    # FIX 2: Using robust serverless connection settings (health_check_interval)
    r = redis.Redis.from_url(
        REDIS_URL, 
        decode_responses=True, 
        socket_connect_timeout=5, 
        socket_timeout=5,
        health_check_interval=10 
    )
else:
    r = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "fallback_dev_key")

# --- SCHEMAS ---
class UserCreate(BaseModel): username: str; password: str; passport: str
class LocationUpdate(BaseModel): username: str; lat: float; lng: float

def get_db():
    db = SessionLocal()
    try: yield db
    finally: db.close()

def create_digital_id(passport: str):
    return "DID_" + hashlib.sha256(passport.encode()).hexdigest()[:12].upper()

def is_zone_active(zone: SafeZone, current_utc: datetime, current_ist_time) -> bool:
    if zone.expires_at and current_utc > zone.expires_at: return False
    if zone.active_from and zone.active_to:
        if zone.active_from <= zone.active_to:
            return zone.active_from <= current_ist_time <= zone.active_to
        else:
            return current_ist_time >= zone.active_from or current_ist_time <= zone.active_to
    return True

def get_safety_status(lat, lng, db):
    now_utc = datetime.utcnow()
    ist = pytz.timezone('Asia/Kolkata')
    now_ist_time = datetime.now(ist).time()
    zones = db.query(SafeZone).all()
    active_zones = [z for z in zones if is_zone_active(z, now_utc, now_ist_time)]
    
    for zone in active_zones:
        distance = math.sqrt((lat - zone.lat)**2 + (lng - zone.lng)**2) * 111000 
        if distance <= zone.radius:
            return f"Entered {zone.name}", "danger" if zone.category != "Safe" else "success"
    return "You are in a safe area", "info"

@app.post("/api/signup")
def signup(user: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == user.username).first(): raise HTTPException(status_code=400)
    new_user = User(username=user.username, hashed_password=pwd_context.hash(user.password), digital_id=create_digital_id(user.passport))
    db.add(new_user)
    db.commit()
    return {"message": "User created", "digital_id": new_user.digital_id}

@app.post("/api/login")
def login(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == user.username).first()
    if not db_user or not pwd_context.verify(user.password, db_user.hashed_password): raise HTTPException(status_code=401)
    token = jwt.encode({"sub": db_user.username, "is_admin": db_user.is_admin, "exp": datetime.utcnow() + timedelta(hours=24)}, SECRET_KEY, algorithm="HS256")
    return {"access_token": token, "username": db_user.username, "is_admin": db_user.is_admin}

@app.post("/api/update-location")
def update_location(loc: LocationUpdate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == loc.username).first()
    if not db_user: raise HTTPException(status_code=404)
    
    # 1. Safely update PostgreSQL (The permanent record)
    db_user.last_lat, db_user.last_lng = loc.lat, loc.lng
    db.commit()
    
    # 2. Self-Healing Redis Update (For the Admin Dashboard "Online" status)
    redis_payload = json.dumps({"lat": loc.lat, "lng": loc.lng})
    try:
        r.setex(f"live_loc:{loc.username}", 60, redis_payload)
    except redis.exceptions.ConnectionError:
        # Vercel froze the connection. Disconnect the broken pool and retry once.
        print("Redis connection stale. Reconnecting...")
        r.connection_pool.disconnect()
        try:
            r.setex(f"live_loc:{loc.username}", 60, redis_payload)
        except Exception as e:
            print(f"Redis secondary fail: {e}")
    except Exception as e:
        print(f"Redis general fail: {e}")
        
    status, alert_level = get_safety_status(loc.lat, loc.lng, db)
    return {"status": status, "alert_level": alert_level, "lat": loc.lat, "lng": loc.lng}

@app.post("/api/tourist/sos")
def report_sos_incident(loc: LocationUpdate, db: Session = Depends(get_db)):
    db.add(IncidentReport(username=loc.username, lat=loc.lat, lng=loc.lng))
    db.commit()
    recent_incidents = db.query(IncidentReport).filter(IncidentReport.reported_at >= datetime.utcnow() - timedelta(hours=48)).all()
    cluster_count = sum(1 for inc in recent_incidents if math.sqrt((loc.lat - inc.lat)**2 + (loc.lng - inc.lng)**2) * 111000 <= 1000)
    rad, cat, z_name = (800, "High Danger", "CRITICAL: SOS Alerts!") if cluster_count >= 3 else (200, "Danger", "CAUTION: SOS Reported")
    db.add(SafeZone(name=z_name, lat=loc.lat, lng=loc.lng, radius=rad, category=cat, expires_at=datetime.utcnow() + timedelta(hours=6), source="UserSOS"))
    db.commit()
    return {"message": "Danger zone mapped."}

@app.get("/api/tourist/explore-google")
async def explore_nearby_tourist_only(lat: float, lng: float, db: Session = Depends(get_db)):
    """
    Fetches nearby Wiki articles, filters for Tourist Attractions, 
    and uses the internal DB as a failsafe.
    """
    places = []
    # Wikipedia strictly requires a User-Agent header
    headers = {"User-Agent": "RakshaSetu/1.0 (sunilpandab37@gmail.com)"}
    
    # 1. Fetch nearby pages with descriptions in one call
    wiki_url = (
        f"https://en.wikipedia.org/w/api.php?action=query&generator=geosearch"
        f"&ggscoord={lat}|{lng}&ggsradius=10000&ggslimit=20"
        f"&prop=description|coordinates&format=json"
    )

    try:
        async with httpx.AsyncClient(timeout=10.0, headers=headers) as client:
            res = await client.get(wiki_url)
            if res.status_code == 200:
                data = res.json().get('query', {}).get('pages', {})
                
                # Keywords to identify a tourist spot from descriptions
                tourist_keywords = [
                    "temple", "monument", "museum", "park", "beach", "palace", 
                    "historic", "sanctuary", "landmark", "fort", "lake", "waterfall", 
                    "church", "mosque", "garden", "wildlife", "nature", "ancient","tourist","places"
                ]

                for page_id, info in data.items():
                    desc = info.get('description', '').lower()
                    title = info.get('title', '').lower()
                    
                    # Filter: Only add if description or title contains tourist keywords
                    if any(word in desc or word in title for word in tourist_keywords):
                        coords_list = info.get('coordinates', [])
                        if coords_list:
                            p_lat = coords_list[0].get('lat')
                            p_lng = coords_list[0].get('lon')
                            
                            if p_lat is not None and p_lng is not None:
                                # Calculate distance (1 deg ~ 111km)
                                dist = math.sqrt((lat - p_lat)**2 + (lng - p_lng)**2) * 111
                                places.append({
                                    "id": str(page_id),
                                    "name": info.get('title'),
                                    "lat": p_lat, 
                                    "lng": p_lng,
                                    "rating": "Wiki", 
                                    "distance": dist
                                })
    except Exception as e:
        print(f"Wikipedia API Error: {e}")

    # 2. FAILSAFE: Use your internal database if Wiki results are low
    # This prevents the "Scanning..." spinner from getting stuck
    if len(places) < 5:
        internal_places = db.query(Place).all()
        for p in internal_places:
            # COORDINATE FIX: Explicitly check for None to avoid TypeError
            if p.lat is not None and p.lng is not None:
                dist = math.sqrt((lat - p.lat)**2 + (lng - p.lng)**2) * 111
                
                # Prevent duplicates (check if already added by Wiki)
                if not any(p.name.lower() in item['name'].lower() for item in places):
                    places.append({
                        "id": f"db_{p.id}", 
                        "name": p.name, 
                        "lat": p.lat, 
                        "lng": p.lng,
                        "rating": "Local", 
                        "distance": dist
                    })

    # Sort by closest first and return top 10 results
    places.sort(key=lambda x: x['distance'])
    return places[:10]
@app.get("/api/admin/tourists")
def get_all_tourists(db: Session = Depends(get_db)):
    users = db.query(User).filter(User.is_admin == False).all()
    if not users: return []
    try: live_data_list = r.mget([f"live_loc:{u.username}" for u in users])
    except: live_data_list = [None] * len(users)
    return [{"id": u.id, "username": u.username, "last_lat": json.loads(l)["lat"] if l else u.last_lat, "last_lng": json.loads(l)["lng"] if l else u.last_lng, "is_online": l is not None} for u, l in zip(users, live_data_list)]

@app.delete("/api/admin/tourist-location/{username}")
def delete_live_location(username: str):
    try: r.delete(f"live_loc:{username}")
    except: pass
    return {"message": "Trace cleared"}

@app.delete("/api/admin/users/{user_id}")
def delete_user_permanently(user_id: int, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.id == user_id).first()
    if db_user: 
        try: r.delete(f"live_loc:{db_user.username}")
        except: pass
        db.delete(db_user); db.commit()
    return {"message": "User deleted."}

@app.get("/api/admin/safe-zones")
def get_safe_zones(db: Session = Depends(get_db)):
    now_utc, now_ist_time = datetime.utcnow(), datetime.now(pytz.timezone('Asia/Kolkata')).time()
    return [z for z in db.query(SafeZone).all() if is_zone_active(z, now_utc, now_ist_time)]



@app.delete("/api/admin/safe-zones/{zone_id}")
def delete_safe_zone(zone_id: int, db: Session = Depends(get_db)):
    db_zone = db.query(SafeZone).filter(SafeZone.id == zone_id).first()
    if db_zone: db.delete(db_zone); db.commit()
    return {"message": "Zone deleted"}

@app.get("/api/places")
def get_places(db: Session = Depends(get_db)):
    return db.query(Place).all()

async def get_smart_safety_category(p_name: str, p_type: str, lat: float, lng: float, p_rating: float, p_fee: float, db: Session) -> str:
    category = "Safe"
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            res = await client.post(HF_API_URL, json={"data": [p_type, p_rating, p_fee]})
            if res.status_code == 200:
                event_id = res.json().get("event_id")
                await asyncio.sleep(0.5) 
                prediction = (await client.get(f"{HF_API_URL}/{event_id}")).json().get('data', [0])[0] 
                category = {0: "Safe", 1: "Danger", 2: "High Danger"}.get(int(prediction), "Safe")
    except: pass

    is_night = datetime.now(pytz.timezone('Asia/Kolkata')).hour >= 19 or datetime.now(pytz.timezone('Asia/Kolkata')).hour <= 5 
    p_lower = p_type.lower()
    if is_night:
        if category == "Safe" and any(t in p_lower for t in ["park", "atm", "beach", "lake"]): category = "Danger"
        elif category == "Danger" and any(t in p_lower for t in ["bar", "club", "liquor"]): category = "High Danger"

    incident_count = sum(1 for inc in db.query(IncidentReport).filter(IncidentReport.reported_at >= datetime.utcnow() - timedelta(hours=48)).all() if math.sqrt((lat - inc.lat)**2 + (lng - inc.lng)**2) * 111000 <= 1000)
    if incident_count >= 3: category = "High Danger"
    elif incident_count in [1, 2] and category == "Safe": category = "Danger"
    return category

async def generate_zones_background(p_name: str, lat: float, lng: float, p_type: str, p_rating: float, p_fee: float, active_from: str, active_to: str):
    db = SessionLocal() 
    try:
        final_category = await get_smart_safety_category(p_name, p_type, lat, lng, p_rating, p_fee, db)
        t_start, t_end = None, None
        try:
            if active_from: t_start = datetime.strptime(active_from, "%H:%M:%S").time()
            if active_to: t_end = datetime.strptime(active_to, "%H:%M:%S").time()
        except: pass

        db.add(SafeZone(name=f"RakshaSetu AI: {p_name} ({p_type})", lat=lat, lng=lng, radius=1000, category=final_category, active_from=t_start, active_to=t_end, source="AI"))
        if GOOGLE_API_KEY:
            async with httpx.AsyncClient() as client:
                tasks = [client.get(f"{GOOGLE_SEARCH_URL}?location={lat},{lng}&radius=5000&type={t}&key={GOOGLE_API_KEY}") for t in ["police", "hospital", "night_club", "bar", "park"]]
                for res in await asyncio.gather(*tasks, return_exceptions=True):
                    if isinstance(res, httpx.Response) and res.status_code == 200:
                        for item in res.json().get('results', [])[:3]:
                            t_s, t_e = None, None
                            poi = item.get('types', [])
                            if "night_club" in poi: cat, rad, t_s, t_e = "High Danger", 300, dt_time(22, 0), dt_time(4, 0)
                            elif "bar" in poi: cat, rad, t_s, t_e = "Danger", 400, dt_time(20, 0), dt_time(2, 0)
                            elif "park" in poi: cat, rad, t_s, t_e = "Danger", 600, dt_time(19, 0), dt_time(6, 0)
                            elif any(t in poi for t in ["police", "hospital"]): cat, rad = "Safe", 500
                            else: continue
                            db.add(SafeZone(name=item.get('name'), lat=item['geometry']['location']['lat'], lng=item['geometry']['location']['lng'], radius=rad, category=cat, active_from=t_s, active_to=t_e, source="Google"))
        db.commit()
    finally: db.close()

@app.post("/api/admin/places")
async def add_place_with_wiki_ai(place: dict, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    lat = float(place.get('lat')) if place.get('lat') else None
    lng = float(place.get('lng')) if place.get('lng') else None
    
    # 1. Save the main place record
    new_p = Place(
        name=place.get('name', 'Unknown'), 
        city=place.get('city', ''), 
        img=place.get('img', ''), 
        details=place.get('details', ''), 
        lat=lat, lng=lng
    )
    db.add(new_p)
    db.commit() 
    
    # 2. Trigger Hybrid AI to find 2-3 Safe and 2-3 Danger zones nearby
    if lat and lng: 
        # Extract variables for HF model
        p_type = place.get('type', 'tourist attraction')
        p_rating = float(place.get('rating', 4.5))
        p_fee = float(place.get('fee', 0.0))
        
        background_tasks.add_task(
            generate_hybrid_smart_zones, 
            place.get('name'), lat, lng, p_type, p_rating, p_fee
        )
        
    return {"message": "Place saved. Analyzing 5km radius for safety/danger zones..."}

async def generate_hybrid_smart_zones(p_name: str, lat: float, lng: float, p_type: str, p_rating: float, p_fee: float):
    db = SessionLocal()
    headers = {"User-Agent": "RakshaSetu/1.0 (sunilpandab37@gmail.com)"}
    
    try:
        # --- PHASE 1: HF AI CATEGORY FOR MAIN SITE ---
        # Uses your existing HF API logic to classify the main place
        main_category = await get_smart_safety_category(p_name, p_type, lat, lng, p_rating, p_fee, db)
        db.add(SafeZone(
            name=f"AI Analysis: {p_name}",
            lat=lat, lng=lng, radius=1000,
            category=main_category, source="HF-AI"
        ))

        # --- PHASE 2: WIKIPEDIA GEOSCAN (The fix for multiple zones) ---
        # We search for everything within 5km of the coordinates
        wiki_url = (
            f"https://en.wikipedia.org/w/api.php?action=query&generator=geosearch"
            f"&ggscoord={lat}|{lng}&ggsradius=5000&ggslimit=30&prop=description|coordinates&format=json"
        )

        async with httpx.AsyncClient(timeout=15.0, headers=headers) as client:
            res = await client.get(wiki_url)
            if res.status_code == 200:
                pages = res.json().get('query', {}).get('pages', {})
                
                safe_found, danger_found = 0, 0
                
                for _, info in pages.items():
                    # Stop once we have 3 of each
                    if safe_found >= 3 and danger_found >= 3: break
                    
                    desc = info.get('description', '').lower()
                    title = info.get('title', '').lower()
                    coords = info.get('coordinates', [{}])[0]
                    p_lat, p_lng = coords.get('lat'), coords.get('lon')
                    
                    if p_lat is None or p_lng is None: continue

                    # Identify Danger Zones (Nightlife, Bars, or thick Forests)
                    if danger_found < 3 and any(w in desc or w in title for w in ["bar", "club", "liquor", "pub", "isolated", "forest"]):
                        db.add(SafeZone(
                            name=f"Wiki-Danger: {info.get('title')}",
                            lat=p_lat, lng=p_lng, radius=400,
                            category="Danger",
                            active_from=dt_time(20, 0), active_to=dt_time(4, 0), # Night only
                            source="Wikipedia-AI"
                        ))
                        danger_found += 1
                    
                    # Identify Safe Zones (Religious sites, Hospitals, Police stations)
                    elif safe_found < 3 and any(w in desc or w in title for w in ["temple", "shrine", "mosque", "church", "hospital", "police", "government"]):
                        db.add(SafeZone(
                            name=f"Wiki-Safe: {info.get('title')}",
                            lat=p_lat, lng=p_lng, radius=500,
                            category="Safe", source="Wikipedia-AI"
                        ))
                        safe_found += 1

        db.commit()
    except Exception as e:
        print(f"Hybrid AI Error: {e}")
    finally:
        db.close()
@app.put("/api/admin/places/{place_id}")
def update_place(place_id: int, place_data: dict, db: Session = Depends(get_db)):
    db_place = db.query(Place).filter(Place.id == place_id).first()
    if not db_place: raise HTTPException(status_code=404)
    db_place.name, db_place.city, db_place.img, db_place.details = place_data.get('name', db_place.name), place_data.get('city', db_place.city), place_data.get('img', db_place.img), place_data.get('details', db_place.details)
    if place_data.get('lat'): db_place.lat = float(place_data['lat'])
    if place_data.get('lng'): db_place.lng = float(place_data['lng'])
    db.commit()
    return {"message": "Updated"}

@app.delete("/api/admin/places/{place_id}")
def delete_place(place_id: int, db: Session = Depends(get_db)):
    db_place = db.query(Place).filter(Place.id == place_id).first()
    if db_place: db.delete(db_place); db.commit()
    return {"message": "Deleted"}