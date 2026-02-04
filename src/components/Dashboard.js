import React, { useState, useEffect } from 'react';
import { Button, Badge, Container, Card } from 'react-bootstrap';
import { ShieldAlert, Navigation, MapPin } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import { motion } from 'framer-motion';
import L from 'leaflet';

// Essential Leaflet CSS
import 'leaflet/dist/leaflet.css';

// Fix for default Leaflet marker icons
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Component to handle auto-panning the map when location changes
function RecenterMap({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords) {
      map.setView([coords.lat, coords.lng], map.getZoom());
    }
  }, [coords, map]);
  return null;
}

const Dashboard = ({ user }) => {
  const [location, setLocation] = useState({ lat: 27.1751, lng: 78.0421 }); // Default to Taj Mahal
  const [safeZones, setSafeZones] = useState([]);
  const [nearestZone, setNearestZone] = useState(null);
  const [serverData, setServerData] = useState({ status: "Scanning...", digital_id: user.digital_id });

  // Function to calculate distance between two points in meters
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; 
  };

  useEffect(() => {
    // 1. Fetch Safe Zones once on load
    fetch('/api/admin/safe-zones')
      .then(res => res.json())
      .then(data => setSafeZones(Array.isArray(data) ? data : []));

    // 2. Start Geolocation Watch
    const geo = navigator.geolocation.watchPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      const currentLoc = { lat: parseFloat(latitude), lng: parseFloat(longitude) };
      setLocation(currentLoc);

      // 3. Update backend via Redis
      try {
        const response = await fetch('/api/update-location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            username: user.username, 
            lat: currentLoc.lat, 
            lng: currentLoc.lng 
          })
        });
        const data = await response.json();
        setServerData(data);
      } catch (err) {
        console.error("Location update failed:", err);
      }
    }, (err) => console.error("Geolocation error:", err), { 
      enableHighAccuracy: true,
      maximumAge: 10000 
    });

    return () => navigator.geolocation.clearWatch(geo);
  }, [user.username]);

  // Update nearest zone whenever location or safeZones change
  useEffect(() => {
    if (safeZones.length > 0 && location) {
      const distances = safeZones.map(zone => ({
        ...zone,
        dist: calculateDistance(location.lat, location.lng, zone.lat, zone.lng)
      }));
      const closest = distances.sort((a, b) => a.dist - b.dist)[0];
      setNearestZone(closest);
    }
  }, [location, safeZones]);

  return (
    <Container className="mt-5 pb-5">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        
        {/* Status Header */}
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h2 className="fw-bold mb-0">Travel Monitor</h2>
            <small className="text-muted">Digital ID: {user.digital_id}</small>
          </div>
          <Badge 
            pill 
            bg={serverData.status.includes("Alert") ? "danger" : "success"} 
            className="px-3 py-2 shadow-sm"
          >
            {serverData.status.toUpperCase()}
          </Badge>
        </div>

        <div className="auth-card-inner p-0 overflow-hidden shadow-lg border-0">
          {/* Map Section */}
          <div style={{ height: '450px', position: 'relative' }}>
            <MapContainer center={[location.lat, location.lng]} zoom={14} style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              
              <Marker position={[location.lat, location.lng]}>
                <Popup>You are here</Popup>
              </Marker>

              {safeZones.map(zone => (
                <Circle 
                  key={zone.id} 
                  center={[zone.lat, zone.lng]} 
                  radius={zone.radius} 
                  pathOptions={{ 
                    color: '#ff547b', 
                    fillColor: '#ff547b', 
                    fillOpacity: 0.2 
                  }} 
                >
                  <Popup>Safe Zone: {zone.name}</Popup>
                </Circle>
              ))}
              
              <RecenterMap coords={location} />
            </MapContainer>
          </div>

          {/* User Info & SOS Section */}
          <div className="p-4 bg-white">
            <Row className="mb-4 text-center g-3">
              <Col xs={6}>
                <Card className="border-0 bg-light p-3">
                  <small className="text-muted d-block"><Navigation size={14} className="me-1"/> Nearest Zone</small>
                  <span className="fw-bold text-dark">{nearestZone ? nearestZone.name : "N/A"}</span>
                </Card>
              </Col>
              <Col xs={6}>
                <Card className="border-0 bg-light p-3">
                  <small className="text-muted d-block"><MapPin size={14} className="me-1"/> Distance</small>
                  <span className="fw-bold text-dark">
                    {nearestZone ? `${(nearestZone.dist / 1000).toFixed(2)} km` : "Scanning..."}
                  </span>
                </Card>
              </Col>
            </Row>

            <Button 
              variant="danger" 
              className="btn-pill-gradient w-100 py-3 fw-bold border-0 shadow-lg"
              style={{ fontSize: '1.1rem' }}
              onClick={() => alert("SOS Triggered! Authorities Notified.")}
            >
              <ShieldAlert className="me-2" /> SOS EMERGENCY
            </Button>
          </div>
        </div>
      </motion.div>
    </Container>
  );
};

export default Dashboard;