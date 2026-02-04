import React, { useState, useEffect } from 'react';
import { Button, Badge, Alert, Container, Row, Col } from 'react-bootstrap';
import { Activity, Fingerprint, Navigation, ShieldAlert } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import { motion } from 'framer-motion';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Leaflet icon fix
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
    map.setView([coords.lat, coords.lng]);
  }, [coords, map]);
  return null;
}

const Dashboard = ({ user }) => {
  const [location, setLocation] = useState({ lat: 27.1751, lng: 78.0421 });
  const [serverData, setServerData] = useState({ status: "Scanning...", digital_id: user.digital_id });

  useEffect(() => {
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
      } catch (err) { 
        console.error("Tracking Error", err); 
      }
    }, (err) => console.error(err), { enableHighAccuracy: true });

    return () => navigator.geolocation.clearWatch(geo);
  }, [user.username]);

  return (
    <Container className="mt-5 pb-5">
      <motion.div 
        className="main-glass-outer"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="auth-card-inner p-0 overflow-hidden shadow-none border-0">
          <div style={{ height: '350px', width: '100%', position: 'relative' }}>
            <MapContainer center={[location.lat, location.lng]} zoom={15} style={{ height: '100%', width: '100%' }}>
              <TileLayer 
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
                attribution='&copy; OpenStreetMap'
              />
              <Marker position={[location.lat, location.lng]}>
                <Popup>DID: {user.digital_id}</Popup>
              </Marker>
              <Circle 
                center={[27.1751, 78.0421]} 
                radius={1000} 
                pathOptions={{ color: '#ff547b', fillColor: '#ff8a71', fillOpacity: 0.2 }} 
              />
              <RecenterMap coords={location} />
            </MapContainer>
          </div>

          <div className="p-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <div>
                <h4 className="fw-bold text-dark mb-1">RakshaSetu Monitor</h4>
                <small className="text-muted"><Fingerprint size={14} className="me-1"/> DID: {user.digital_id}</small>
              </div>
              <Badge 
                className="p-2 shadow-sm border-0"
                style={{ 
                    backgroundColor: serverData.status === "Safe" ? "#dcfce7" : "#fee2e2", 
                    color: serverData.status === "Safe" ? "#166534" : "#991b1b",
                    borderRadius: '10px'
                }}
              >
                <Activity size={14} className="me-1" /> {serverData.status}
              </Badge>
            </div>

            <Row className="g-3 mb-4">
              <Col xs={6}>
                <div className="p-3 bg-light rounded-4 text-center border-0 shadow-sm">
                  <Navigation size={18} className="mb-1" style={{ color: '#ff8a71' }} />
                  <small className="text-muted d-block">Latitude</small>
                  <span className="fw-bold">{location.lat.toFixed(4)}</span>
                </div>
              </Col>
              <Col xs={6}>
                <div className="p-3 bg-light rounded-4 text-center border-0 shadow-sm">
                  <Navigation size={18} className="mb-1" style={{ color: '#ff8a71', transform: 'rotate(90deg)' }} />
                  <small className="text-muted d-block">Longitude</small>
                  <span className="fw-bold">{location.lng.toFixed(4)}</span>
                </div>
              </Col>
            </Row>

            <Button className="btn-pill-gradient w-100 py-3 fw-bold border-0">
              <ShieldAlert className="me-2" /> TRIGGER EMERGENCY SOS
            </Button>
          </div>
        </div>
      </motion.div>

      {serverData.status !== "Safe" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4">
          <Alert variant="danger" className="border-0 shadow-sm" style={{ borderRadius: '20px', backgroundColor: '#fff1f2', color: '#be123c' }}>
            <strong>⚠️ Security Notice:</strong> You are currently outside the designated safe zone. 
          </Alert>
        </motion.div>
      )}
    </Container>
  );
};

export default Dashboard;