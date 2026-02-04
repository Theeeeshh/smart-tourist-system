import React, { useState, useEffect } from 'react';
import { Button, Badge, Container, Card, Row, Col } from 'react-bootstrap'; // Verified imports
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

function RecenterMap({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords) { map.setView([coords.lat, coords.lng], map.getZoom()); }
  }, [coords, map]);
  return null;
}

const Dashboard = ({ user }) => {
  const [location, setLocation] = useState({ lat: 27.1751, lng: 78.0421 }); 
  const [safeZones, setSafeZones] = useState([]);
  const [nearestZone, setNearestZone] = useState(null);
  const [serverData, setServerData] = useState({ status: "Scanning...", digital_id: user.digital_id });

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  };

  useEffect(() => {
    fetch('/api/admin/safe-zones').then(res => res.json()).then(data => setSafeZones(data));

    const geo = navigator.geolocation.watchPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      
      // CRITICAL: Ensure these are numbers, not strings, to fix 422 error
      const currentLoc = { 
        lat: Number(latitude), 
        lng: Number(longitude) 
      };
      
      setLocation(currentLoc);

      try {
        const response = await fetch('/api/update-location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            username: user.username, 
            lat: currentLoc.lat, 
            lng: currentLoc.lng // Must match 'lng' in Pydantic schema
          })
        });
        const data = await response.json();
        setServerData(data);
      } catch (err) { console.error("Update failed:", err); }
    }, (err) => console.error(err), { enableHighAccuracy: true });

    return () => navigator.geolocation.clearWatch(geo);
  }, [user.username]);

  useEffect(() => {
    if (safeZones.length > 0 && location) {
      const distances = safeZones.map(zone => ({
        ...zone,
        dist: calculateDistance(location.lat, location.lng, zone.lat, zone.lng)
      }));
      setNearestZone(distances.sort((a, b) => a.dist - b.dist)[0]);
    }
  }, [location, safeZones]);

  return (
    <Container className="mt-5 pb-5">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2 className="fw-bold mb-0">Travel Monitor</h2>
          <Badge pill bg={serverData.status.includes("Alert") ? "danger" : "success"}>
            {serverData.status}
          </Badge>
        </div>

        <div className="auth-card-inner p-0 overflow-hidden shadow-lg">
          <div style={{ height: '400px' }}>
            <MapContainer center={[location.lat, location.lng]} zoom={14} style={{ height: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Marker position={[location.lat, location.lng]}><Popup>You</Popup></Marker>
              {safeZones.map(zone => (
                <Circle key={zone.id} center={[zone.lat, zone.lng]} radius={zone.radius} pathOptions={{ color: '#ff547b' }} />
              ))}
              <RecenterMap coords={location} />
            </MapContainer>
          </div>

          <div className="p-4 bg-white">
            <Row className="mb-4 text-center g-3">
              <Col xs={6}>
                <Card className="border-0 bg-light p-2">
                  <small className="text-muted d-block">Nearest Zone</small>
                  <span className="fw-bold">{nearestZone ? nearestZone.name : "N/A"}</span>
                </Card>
              </Col>
              <Col xs={6}>
                <Card className="border-0 bg-light p-2">
                  <small className="text-muted d-block">Distance</small>
                  <span className="fw-bold">{nearestZone ? `${(nearestZone.dist / 1000).toFixed(2)} km` : "..."}</span>
                </Card>
              </Col>
            </Row>
            <Button variant="danger" className="btn-pill-gradient w-100 py-3 fw-bold border-0 shadow" onClick={() => alert("SOS Alert Sent!")}>
              <ShieldAlert className="me-2" /> SOS EMERGENCY
            </Button>
          </div>
        </div>
      </motion.div>
    </Container>
  );
};

export default Dashboard;