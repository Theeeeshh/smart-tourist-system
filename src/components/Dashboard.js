import React, { useState, useEffect, useRef } from 'react';
import { Container, Row, Col, Card, Badge, ListGroup, Button, Spinner } from 'react-bootstrap';
import { Phone, ShieldAlert, Navigation, Compass, AlertTriangle, ExternalLink } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Circle, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default Leaflet marker icons
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({ iconUrl: markerIcon, shadowUrl: markerShadow, iconSize: [25, 41], iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

// Smoothly pans the map to follow the user's GPS
function MapRecenter({ location }) {
  const map = useMap();
  useEffect(() => { 
    if (location) map.flyTo([location.lat, location.lng], 14, { duration: 1.5 }); 
  }, [location, map]);
  return null;
}

const Dashboard = ({ user }) => {
  const [location, setLocation] = useState(null);
  const [city, setCity] = useState("Detecting...");
  const [contacts, setContacts] = useState([]);
  const [safety, setSafety] = useState({ status: "Scanning area...", alert_level: "info" });
  
  const [zones, setZones] = useState([]);
  
  // NEW LOADING STATE FOR PLACES
  const [nearbyPlaces, setNearbyPlaces] = useState([]);
  const [isExploreLoading, setIsExploreLoading] = useState(true); 
  const [isSosLoading, setIsSosLoading] = useState(false);

  const cityFetched = useRef(false);
  const googleFetched = useRef(false);

  const fetchMapData = async () => {
    try {
      const zRes = await fetch('/api/admin/safe-zones');
      if (zRes.ok) setZones(await zRes.json());
    } catch (err) { console.error("Error fetching zones:", err); }
  };

  useEffect(() => {
    fetchMapData();
    const interval = setInterval(fetchMapData, 15000); 
    return () => clearInterval(interval);
  }, []);

  const fetchLocalContacts = async (lat, lng) => {
    if (cityFetched.current) return;
    try {
      cityFetched.current = true;
      const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const geoData = await geoRes.json();
      const area = geoData.address?.city || geoData.address?.state_district || geoData.address?.state || "India";
      setCity(area);
      
      const emergencyDb = { 
        "Kerala": [{ service: "Police", number: "112" }, { service: "Ambulance", number: "108" }], 
        "Ooty": [{ service: "Ooty Police", number: "0423-2442200" }, { service: "Tourist Help", number: "1077" }],
        "Nilgiris": [{ service: "Nilgiris Police", number: "0423-2444065" }]
      };
      const matchedKey = Object.keys(emergencyDb).find(k => area.includes(k));
      setContacts(emergencyDb[matchedKey] || [{ service: "National Emergency", number: "112" }]);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    const watchId = navigator.geolocation.watchPosition(async (pos) => {
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setLocation(coords);
      fetchLocalContacts(coords.lat, coords.lng);
      
      try {
        const res = await fetch('/api/update-location', { 
          method: 'POST', headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ username: user.username, ...coords }) 
        });
        if (res.ok) setSafety(await res.json());
      } catch (err) { console.error(err); }
    }, null, { enableHighAccuracy: true });
    
    return () => navigator.geolocation.clearWatch(watchId);
  }, [user.username]);

  // Fetch Nearby Places with proper Loading State
  useEffect(() => {
    if (location && !googleFetched.current) {
      const fetchGooglePlaces = async () => {
        try {
          googleFetched.current = true;
          setIsExploreLoading(true); // Start spinner
          const res = await fetch(`/api/tourist/explore-google?lat=${location.lat}&lng=${location.lng}`);
          if (res.ok) setNearbyPlaces(await res.json());
        } catch (err) { 
          console.error("Explore API error:", err); 
        } finally {
          setIsExploreLoading(false); // Stop spinner
        }
      };
      fetchGooglePlaces();
    }
  }, [location]);

  const handleSOS = async () => {
    if (!location) return alert("Waiting for GPS signal...");
    if (window.confirm("🚨 Are you in danger? This will broadcast an alert!")) {
      setIsSosLoading(true);
      try {
        await fetch('/api/tourist/sos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: user.username, lat: location.lat, lng: location.lng }) });
        alert("SOS Broadcasted! A temporary danger zone has been generated.");
        fetchMapData(); 
      } catch (err) { alert("Failed to send SOS."); } 
      finally { setIsSosLoading(false); }
    }
  };

  if (!location) {
    return (
      <Container className="d-flex flex-column justify-content-center align-items-center" style={{height: '100vh'}}>
        <Spinner animation="grow" variant="primary" className="mb-3" />
        <h5>Acquiring GPS Signal...</h5>
      </Container>
    );
  }

  return (
    <Container fluid className="mt-4 px-4 pb-5">
      <Row className="mb-4 align-items-center">
        <Col md={8} className="mb-2 mb-md-0">
          <Badge bg={safety.alert_level === "danger" ? "danger" : safety.alert_level === "success" ? "success" : "primary"} className="w-100 p-3 fs-5 shadow-sm text-start d-flex align-items-center">
            {safety.alert_level === "danger" ? <AlertTriangle className="me-2"/> : <ShieldAlert className="me-2"/>} Status: {safety.status}
          </Badge>
        </Col>
        <Col md={4}>
          <Button variant="danger" size="lg" className="w-100 fw-bold shadow-sm d-flex justify-content-center align-items-center" onClick={handleSOS} disabled={isSosLoading}>
            {isSosLoading ? <Spinner size="sm" className="me-2"/> : <Phone className="me-2" />} SOS / FEEL UNSAFE
          </Button>
        </Col>
      </Row>

      <Row className="g-4">
        <Col lg={8}>
          <Card className="shadow-sm border-0 rounded-4 overflow-hidden">
            <Card.Body className="p-0">
              <div className="p-3 bg-white d-flex justify-content-between align-items-center border-bottom">
                <h5 className="fw-bold mb-0 text-primary"><Navigation size={20} className="me-2"/>Live Safety Map</h5>
                <Badge bg="light" className="text-dark border">Location: {city}</Badge>
              </div>
              <div style={{ height: '500px' }}>
                <MapContainer center={[location.lat, location.lng]} zoom={14} style={{ height: '100%' }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <MapRecenter location={location} />
                  <Marker position={[location.lat, location.lng]}><Popup><strong>You are here</strong></Popup></Marker>
                  {zones.map(z => {
                    let color = z.category === 'High Danger' ? '#000000' : z.category === 'Danger' ? '#dc3545' : '#198754';
                    return <Circle key={z.id} center={[parseFloat(z.lat), parseFloat(z.lng)]} radius={z.radius} pathOptions={{ color, fillColor: color, fillOpacity: 0.25 }}><Popup><strong>{z.name}</strong></Popup></Circle>;
                  })}
                </MapContainer>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={4}>
          <Card className="shadow-sm border-0 rounded-4 mb-4">
            <Card.Header className="bg-white fw-bold py-3 border-bottom-0"><Compass size={18} className="me-2 text-primary"/>Explore Nearby</Card.Header>
            <ListGroup variant="flush" className="overflow-auto" style={{ maxHeight: '250px' }}>
              
              {/* THE NEW LOADING LOGIC */}
              {isExploreLoading ? (
                <ListGroup.Item className="text-muted text-center py-4"><Spinner size="sm" className="me-2"/> Searching...</ListGroup.Item>
              ) : nearbyPlaces.length === 0 ? (
                <ListGroup.Item className="text-muted text-center py-4">No places found.</ListGroup.Item>
              ) : (
                nearbyPlaces.map(p => (
                  <ListGroup.Item key={p.id} className="d-flex justify-content-between align-items-center">
                    <div>
                      <span className="fw-semibold d-block">{p.name}</span>
                      <small className="text-muted">⭐ {p.rating} • {p.distance.toFixed(1)} km</small>
                    </div>
                    {/* Fixed Google Maps Directions URL */}
                    <Button variant="outline-primary" size="sm" href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink size={14}/>
                    </Button>
                  </ListGroup.Item>
              )))}

            </ListGroup>
          </Card>

          <Card className="shadow-sm border-0 rounded-4">
            <Card.Header className="bg-white fw-bold py-3 text-danger border-bottom-0"><Phone size={18} className="me-2"/>Local Help</Card.Header>
            <ListGroup variant="flush">
              {contacts.map((c, i) => (
                <ListGroup.Item key={i} className="d-flex justify-content-between align-items-center">
                  <span className="fw-medium">{c.service}</span> 
                  <Button size="sm" variant="danger" href={`tel:${c.number}`}>{c.number}</Button>
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