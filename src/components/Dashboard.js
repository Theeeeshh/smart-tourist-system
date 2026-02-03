import React, { useState } from 'react';
import { Card, Button, Badge, Alert, Container } from 'react-bootstrap';
import { ShieldCheck, MapPin, Activity, Fingerprint } from 'lucide-react'; // Added Fingerprint here

const Dashboard = ({ user }) => {
  const [location, setLocation] = useState({ lat: 0, lng: 0 });
  const [serverData, setServerData] = useState({ status: "Scanning...", current_zone: "N/A" });

  useEffect(() => {
    // Start Live Tracking using Browser Geolocation API
    const geo = navigator.geolocation.watchPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      setLocation({ lat: latitude, lng: longitude });

      // Sync with FastAPI Geofence Engine on Vercel
      try {
        const response = await fetch('/api/update-location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: user.username,
            lat: latitude,
            lng: longitude
          })
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
    <Container className="mt-4">
      <Card className="shadow-lg border-0 mb-4">
        <Card.Body className="p-4">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div>
              <h4 className="fw-bold mb-1">Live Safety Monitor</h4>
              {/* This line was causing your error - now Fingerprint is defined */}
              <small className="text-muted"><Fingerprint size={14} className="me-1"/> ID: {user.digital_id}</small>
            </div>
            <Badge bg={serverData.status === "Safe" ? "success" : "danger"} className="p-2">
              <Activity size={14} className="me-1" /> {serverData.status}
            </Badge>
          </div>

          <div className="bg-light rounded p-4 text-center mb-3 border">
            <MapPin className="text-danger mb-2" size={32} />
            <h5 className="mb-1">{serverData.status === "Safe" ? "Monitored Zone" : "Restricted Area"}</h5>
            <p className="text-muted small">Lat: {location.lat.toFixed(4)} | Lng: {location.lng.toFixed(4)}</p>
          </div>

          <Button variant="danger" className="w-100 py-3 fw-bold shadow">
            🚨 TRIGGER EMERGENCY SOS
          </Button>
        </Card.Body>
      </Card>
      
      {serverData.status === "Warning" && (
        <Alert variant="danger" className="animate-pulse">
          <strong>⚠️ Geofence Breach:</strong> You have entered a restricted area. 
          Authorities have been notified via your Blockchain Digital ID.
        </Alert>
      )}
    </Container>
  );
};

export default Dashboard;