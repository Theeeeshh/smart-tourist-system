import React, { useState, useEffect } from 'react';
import { Card, Button, Badge, Alert, Container } from 'react-bootstrap';
import { Activity, Fingerprint } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
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
    <Container className="mt-4 pb-5">
      <Card className="shadow-lg border-0 mb-4 overflow-hidden">
        <div style={{ height: '350px', width: '100%', position: 'relative' }}>
          <MapContainer center={[location.lat, location.lng]} zoom={15} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Marker position={[location.lat, location.lng]}>
              <Popup>You are here <br/> (DID: {user.digital_id})</Popup>
            </Marker>
            <Circle 
              center={[27.1751, 78.0421]} 
              radius={1000} 
              pathOptions={{ color: 'blue', fillColor: 'blue', fillOpacity: 0.1 }} 
            />
            <RecenterMap coords={location} />
          </MapContainer>
        </div>

        <Card.Body className="p-4">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div>
              <h4 className="fw-bold mb-1">RakshaSetu Monitor</h4>
              <small className="text-muted"><Fingerprint size={14} className="me-1"/> DID: {user.digital_id}</small>
            </div>
            <Badge bg={serverData.status === "Safe" ? "success" : "danger"} className="p-2">
              <Activity size={14} className="me-1" /> {serverData.status}
            </Badge>
          </div>

          <div className="row g-3 mb-4">
            <div className="col-6">
              <div className="p-3 bg-light rounded text-center border">
                <small className="text-muted d-block">Latitude</small>
                <span className="fw-bold">{location.lat.toFixed(4)}</span>
              </div>
            </div>
            <div className="col-6">
              <div className="p-3 bg-light rounded text-center border">
                <small className="text-muted d-block">Longitude</small>
                <span className="fw-bold">{location.lng.toFixed(4)}</span>
              </div>
            </div>
          </div>

          <Button variant="danger" className="w-100 py-3 fw-bold shadow-sm">
            🚨 TRIGGER EMERGENCY SOS
          </Button>
        </Card.Body>
      </Card>

      {serverData.status !== "Safe" && (
        <Alert variant="warning" className="border-warning">
          <strong>⚠️ Security Notice:</strong> You are currently outside the designated safe zone. 
        </Alert>
      )}
    </Container>
  );
};

export default Dashboard;