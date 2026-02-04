import React, { useState, useEffect } from 'react';
import { Button, Badge, Alert, Container, Row, Col } from 'react-bootstrap';
import { Activity, Fingerprint, Navigation, ShieldAlert } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import { motion } from 'framer-motion';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

function RecenterMap({ coords }) {
  const map = useMap();
  useEffect(() => { map.setView([coords.lat, coords.lng]); }, [coords, map]);
  return null;
}

const Dashboard = ({ user }) => {
  const [location, setLocation] = useState({ lat: 27.1751, lng: 78.0421 });
  const [safeZones, setSafeZones] = useState([]);
  const [serverData, setServerData] = useState({ status: "Scanning...", digital_id: user.digital_id });

  useEffect(() => {
    // 1. Fetch Safe Zones defined by Admin
    fetch('/api/admin/safe-zones')
      .then(res => res.json())
      .then(data => setSafeZones(data));

    // 2. Track Location
    const geo = navigator.geolocation.watchPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      setLocation({ lat: latitude, lng: longitude });

      try {
        const response = await fetch('/api/update-location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: user.username, lat: latitude, lng: longitude })
        });
        const data = await response.json();
        setServerData(data);
      } catch (err) { console.error(err); }
    }, (err) => console.error(err), { enableHighAccuracy: true });

    return () => navigator.geolocation.clearWatch(geo);
  }, [user.username]);

  return (
    <Container className="mt-5 pb-5">
      <motion.div className="main-glass-outer" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="auth-card-inner p-0 overflow-hidden">
          <div style={{ height: '400px' }}>
            <MapContainer center={[location.lat, location.lng]} zoom={13} style={{ height: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              
              {/* User Location */}
              <Marker position={[location.lat, location.lng]}>
                <Popup>You (DID: {user.digital_id})</Popup>
              </Marker>

              {/* Dynamic Admin Safe Zones */}
              {safeZones.map(zone => (
                <Circle 
                  key={zone.id}
                  center={[zone.lat, zone.lng]} 
                  radius={zone.radius} 
                  pathOptions={{ color: '#ff547b', fillColor: '#ff8a71', fillOpacity: 0.2 }} 
                >
                  <Popup>Safe Zone: {zone.name}</Popup>
                </Circle>
              ))}
              <RecenterMap coords={location} />
            </MapContainer>
          </div>

          <div className="p-4">
            <div className="d-flex justify-content-between mb-4">
              <h4 className="fw-bold">Monitor: {user.username}</h4>
              <Badge bg={serverData.status.includes("Alert") ? "danger" : "success"}>
                {serverData.status}
              </Badge>
            </div>
            <Button className="btn-pill-gradient w-100 py-3 fw-bold">
              <ShieldAlert className="me-2" /> SOS EMERGENCY
            </Button>
          </div>
        </div>
      </motion.div>
    </Container>
  );
};

export default Dashboard;