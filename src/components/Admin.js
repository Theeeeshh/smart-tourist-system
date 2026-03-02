import React, { useState, useEffect, useMemo } from 'react';
import { Container, Row, Col, Table, Form, Button, Badge, InputGroup, Spinner } from 'react-bootstrap';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents, useMap } from 'react-leaflet';
import { Users, MapPin, ShieldAlert, Trash2, Edit, Search, Target } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default Leaflet marker icons breaking in React
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Helper: Handles Smooth Zooming to Zones/Places
function MapPanTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target && target.lat && target.lng) {
      map.flyTo([target.lat, target.lng], 16, { duration: 1.5 });
    }
  }, [target, map]);
  return null;
}

// Helper: Captures clicks on the map for coordinate selection
function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

const Admin = () => {
  const [tourists, setTourists] = useState([]);
  const [safeZones, setSafeZones] = useState([]);
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [mapTarget, setMapTarget] = useState(null);
  const [zoneSearch, setZoneSearch] = useState("");
  const [placeSearch, setPlaceSearch] = useState("");

  const [newPlace, setNewPlace] = useState({ 
    name: '', city: '', img: '', details: '', lat: '', lng: '', type: 'Temple', rating: 4.5, fee: 0 
  });
  const [editPlace, setEditPlace] = useState(null);
  const [newZone, setNewZone] = useState({ name: '', lat: '', lng: '', radius: '', category: 'Safe' });
  const [editZone, setEditZone] = useState(null);

  const fetchData = async (signal) => {
    try {
      const [tRes, zRes, pRes] = await Promise.all([
        fetch('/api/admin/tourists', { signal }),
        fetch('/api/admin/safe-zones', { signal }),
        fetch('/api/places', { signal })
      ]);
      if (tRes.ok && zRes.ok && pRes.ok) {
        setTourists(await tRes.json());
        setSafeZones(await zRes.json());
        setPlaces(await pRes.json());
        setLoading(false);
      }
    } catch (err) { if (err.name !== 'AbortError') console.error("Fetch error:", err); }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    const interval = setInterval(() => fetchData(controller.signal), 10000);
    return () => { controller.abort(); clearInterval(interval); };
  }, []);

  // FIXED: Restored handleMapClick function
  const handleMapClick = (lat, lng) => {
    const formattedLat = lat.toFixed(6);
    const formattedLng = lng.toFixed(6);
    if (editZone) setEditZone({ ...editZone, lat: formattedLat, lng: formattedLng });
    else if (editPlace) setEditPlace({ ...editPlace, lat: formattedLat, lng: formattedLng });
    else if (newZone.name !== '') setNewZone({ ...newZone, lat: formattedLat, lng: formattedLng });
    else setNewPlace({ ...newPlace, lat: formattedLat, lng: formattedLng });
  };

  const handlePlaceSubmit = async (e) => {
    e.preventDefault();
    const method = editPlace ? 'PUT' : 'POST';
    const url = editPlace ? `/api/admin/places/${editPlace.id}` : '/api/admin/places';
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editPlace || newPlace)
    });
    setEditPlace(null);
    setNewPlace({ name: '', city: '', img: '', details: '', lat: '', lng: '', type: 'Temple', rating: 4.5, fee: 0 });
    fetchData();
  };

  const handleZoneSubmit = async (e) => {
    e.preventDefault();
    const method = editZone ? 'PUT' : 'POST';
    const url = editZone ? `/api/admin/safe-zones/${editZone.id}` : '/api/admin/safe-zones';
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editZone || newZone)
    });
    setEditZone(null);
    setNewZone({ name: '', lat: '', lng: '', radius: '', category: 'Safe' });
    fetchData();
  };

  const filteredZones = (safeZones || []).filter(z => z.name?.toLowerCase().includes(zoneSearch.toLowerCase()));
  const filteredPlaces = (places || []).filter(p => p.name?.toLowerCase().includes(placeSearch.toLowerCase()));

  const stats = {
    danger: (tourists || []).filter(t => t.is_online && t.current_status?.includes("Danger")).length,
    normal: (tourists || []).filter(t => t.is_online && !t.current_status?.includes("Danger")).length
  };

  if (loading) {
    return (
      <Container className="d-flex justify-content-center align-items-center" style={{height: '80vh'}}>
        <div className="text-center">
          <Spinner animation="border" variant="primary" />
          <p className="mt-3 fw-bold">Compiling Dashboard Data...</p>
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-5">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="fw-bold text-dark m-0">RakshaSetu Command Center</h2>
        <div className="d-flex gap-3">
            <Badge bg="danger" className="p-2 px-3 shadow-sm fs-6">In Danger: {stats.danger}</Badge>
            <Badge bg="success" className="p-2 px-3 shadow-sm fs-6">Normal: {stats.normal}</Badge>
        </div>
      </div>
      
      <Row className="g-4 mb-5">
        <Col lg={8}>
          <div className="auth-card-inner p-0 overflow-hidden" style={{ height: '450px', position: 'relative', borderRadius: '15px', border: '1px solid #ddd' }}>
            <MapContainer center={[20.5937, 78.9629]} zoom={5} style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MapPanTo target={mapTarget} />
              <MapClickHandler onMapClick={handleMapClick} />
              
              {tourists?.map(t => t.last_lat && (
                <Marker key={t.id} position={[t.last_lat, t.last_lng]}>
                  <Popup><strong>{t.username}</strong><br/>Status: {t.current_status || "Safe"}</Popup>
                </Marker>
              ))}

              {safeZones?.map(zone => (
                <Circle 
                  key={zone.id} center={[zone.lat, zone.lng]} radius={zone.radius} 
                  pathOptions={{ 
                    color: zone.category === "High Danger" ? 'black' : zone.category === "Danger" ? 'red' : zone.category === "Safe" ? 'yellow' : 'green',
                    fillColor: zone.category === "High Danger" ? 'black' : zone.category === "Danger" ? 'red' : zone.category === "Safe" ? 'yellow' : 'green',
                    fillOpacity: 0.2 
                  }} 
                />
              ))}
            </MapContainer>
          </div>
        </Col>

        <Col lg={4}>
          <div className="auth-card-inner h-100 shadow-sm p-3">
            <h5 className="fw-bold mb-3"><Users size={20} className="me-2"/>Active Tourists</h5>
            <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
              <Table hover size="sm">
                <thead><tr><th>User</th><th>Target</th></tr></thead>
                <tbody>
                  {tourists?.map(t => (
                    <tr key={t.id}>
                      <td className="align-middle">{t.username}</td>
                      <td><Button variant="link" onClick={() => setMapTarget({lat: t.last_lat, lng: t.last_lng})}><Target size={16}/></Button></td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </div>
        </Col>
      </Row>

      {/* Destination Management Table */}
      <div className="auth-card-inner shadow-sm p-4 mb-5">
        <div className="d-flex justify-content-between mb-3 align-items-center">
            <h5 className="fw-bold m-0"><MapPin size={20} className="me-2"/>Destinations</h5>
            <InputGroup style={{ width: '250px' }}>
                <InputGroup.Text><Search size={16}/></InputGroup.Text>
                <Form.Control placeholder="Search..." value={placeSearch} onChange={e => setPlaceSearch(e.target.value)} />
            </InputGroup>
        </div>
        <Table responsive striped hover size="sm">
          <thead><tr><th>Name</th><th>City</th><th>Live Nearby</th><th>Actions</th></tr></thead>
          <tbody>
            {filteredPlaces.map(p => (
              <tr key={p.id}>
                <td>{p.name}</td><td>{p.city}</td>
                <td><Badge bg="info">{(tourists || []).filter(t => t.last_lat && L.latLng(p.lat, p.lng).distanceTo([t.last_lat, t.last_lng]) < 5000).length} users</Badge></td>
                <td><Button variant="link" onClick={() => setMapTarget({lat: p.lat, lng: p.lng})}><Target size={18}/></Button></td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      {/* Geofence Management Table */}
      <div className="auth-card-inner shadow-sm p-4 mb-5">
        <div className="d-flex justify-content-between mb-3 align-items-center">
            <h5 className="fw-bold m-0 text-danger"><ShieldAlert size={20} className="me-2"/>Geofences</h5>
            <InputGroup style={{ width: '250px' }}>
                <InputGroup.Text><Search size={16}/></InputGroup.Text>
                <Form.Control placeholder="Search..." value={zoneSearch} onChange={e => setZoneSearch(e.target.value)} />
            </InputGroup>
        </div>
        <Table responsive striped hover size="sm">
          <thead><tr><th>Zone Name</th><th>Category</th><th>Inside</th><th>Actions</th></tr></thead>
          <tbody>
            {filteredZones.map(z => (
              <tr key={z.id}>
                <td>{z.name}</td>
                <td><Badge bg={z.category === "High Danger" ? "dark" : z.category === "Danger" ? "danger" : z.category === "Safe" ? "warning" : "success"}>{z.category}</Badge></td>
                <td><Badge bg="secondary">{(tourists || []).filter(t => t.last_lat && L.latLng(z.lat, z.lng).distanceTo([t.last_lat, t.last_lng]) <= z.radius).length}</Badge></td>
                <td><Button variant="outline-primary" size="sm" onClick={() => setMapTarget({lat: z.lat, lng: z.lng})}><Search size={14}/></Button></td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </Container>
  );
};

export default Admin;