import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Badge, ListGroup, Button } from 'react-bootstrap';
import { MapPin, Phone, ShieldAlert, Navigation, Compass } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Circle, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default Leaflet marker icons
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({ iconUrl: markerIcon, shadowUrl: markerShadow, iconSize: [25, 41], iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

const Dashboard = ({ user }) => {
  const [location, setLocation] = useState({ lat: 11.41, lng: 76.69 });
  const [city, setCity] = useState("Detecting...");
  const [contacts, setContacts] = useState([]);
  const [safety, setSafety] = useState({ status: "Scanning...", alert_level: "info" });
  const [zones, setZones] = useState([]);
  const [nearbyPlaces, setNearbyPlaces] = useState([]);

  // --- AUTOMATED EMERGENCY CONTACT LOGIC ---
  const fetchLocalContacts = async (lat, lng) => {
    try {
      // Step 1: Automate city detection using OpenStreetMap Nominatim
      const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const geoData = await geoRes.json();
      const area = geoData.address.city || geoData.address.state_district || geoData.address.state || "India";
      setCity(area);

      // Step 2: Automatically map the detected area to specific numbers
      const emergencyDb = {
        "Kerala": [
          { service: "Police", number: "112" },
          { service: "Women Helpline", number: "181" },
          { service: "Ambulance", number: "108" }
        ],
        "Ooty": [
          { service: "Ooty Police", number: "0423-2442200" },
          { service: "Tourist Help", number: "1077" },
          { service: "Fire", number: "101" }
        ],
        "Nilgiris": [
          { service: "Nilgiris Police", number: "0423-2444065" },
          { service: "Ambulance", number: "108" }
        ]
      };

      const matchedKey = Object.keys(emergencyDb).find(key => area.includes(key));
      setContacts(emergencyDb[matchedKey] || [{ service: "National Help", number: "112" }]);
    } catch (err) { console.error("Geocoding failed", err); }
  };

  useEffect(() => {
    const watchId = navigator.geolocation.watchPosition(async (pos) => {
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setLocation(coords);
      fetchLocalContacts(coords.lat, coords.lng);

      // Real-time backend safety check
      const res = await fetch('/api/update-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.username, ...coords })
      });
      setSafety(await res.json());
      
      // Filter places within 10km
      const pRes = await fetch('/api/places');
      const allP = await pRes.json();
      setNearbyPlaces(allP.filter(p => Math.sqrt((p.lat - coords.lat)**2 + (p.lng - coords.lng)**2) * 111 <= 10));
    });

    fetch('/api/admin/safe-zones').then(r => r.json()).then(setZones);
    return () => navigator.geolocation.clearWatch(watchId);
  }, [user.username]);

  return (
    <Container fluid className="mt-4 px-4">
      <Row className="mb-4">
        <Col><Badge bg={safety.alert_level} className="w-100 p-3 fs-6 shadow-sm">{safety.status}</Badge></Col>
      </Row>

      <Row className="g-4">
        {/* COLUMN 1: WHERE AM I? (MAP) */}
        <Col lg={8}>
          <Card className="shadow-sm border-0 rounded-4 overflow-hidden">
            <Card.Body className="p-0">
              <div className="p-3 bg-white d-flex justify-content-between align-items-center">
                <h5 className="fw-bold mb-0 text-primary"><Navigation size={20} className="me-2"/>Where am I?</h5>
                <Badge bg="light" className="text-dark">Detected: {city}</Badge>
              </div>
              <div style={{ height: '450px' }}>
                <MapContainer center={[location.lat, location.lng]} zoom={13} style={{ height: '100%' }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={[location.lat, location.lng]}><Popup>You are here</Popup></Marker>
                  {zones.map(z => (
                    <Circle 
                      key={z.id} center={[z.lat, z.lng]} radius={z.radius} 
                      pathOptions={{ color: z.category === "High Danger" ? 'red' : z.category === "Danger" ? 'orange' : 'green' }} 
                    />
                  ))}
                </MapContainer>
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* COLUMN 2: PLACES & AUTO-CONTACTS */}
        <Col lg={4}>
          <Card className="shadow-sm border-0 rounded-4 mb-4">
            <Card.Header className="bg-white fw-bold py-3"><Compass size={18} className="me-2 text-success"/>Places (10km)</Card.Header>
            <ListGroup variant="flush">
              {nearbyPlaces.map(p => (
                <ListGroup.Item key={p.id} className="small d-flex justify-content-between">
                  {p.name} <Badge bg="light" className="text-dark">{p.city}</Badge>
                </ListGroup.Item>
              ))}
            </ListGroup>
          </Card>

          <Card className="shadow-sm border-0 rounded-4">
            <Card.Header className="bg-white fw-bold py-3 text-danger"><Phone size={18} className="me-2"/>Local Help ({city})</Card.Header>
            <ListGroup variant="flush">
              {contacts.map((c, i) => (
                <ListGroup.Item key={i} className="d-flex justify-content-between align-items-center small">
                  {c.service} <Button size="sm" variant="outline-danger" href={`tel:${c.number}`}>{c.number}</Button>
                </ListGroup.Item>
              ))}
            </ListGroup>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default Dashboard;