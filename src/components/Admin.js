import React, { useState, useEffect, useMemo } from 'react';
import { Container, Row, Col, Table, Form, Button, Badge, InputGroup } from 'react-bootstrap';
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

// --- HELPER: Handles Smooth Zooming to Zones/Places ---
function MapPanTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target && target.lat && target.lng) {
      map.flyTo([target.lat, target.lng], 16, { duration: 1.5 });
    }
  }, [target, map]);
  return null;
}

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapBoundsManager({ tourists }) {
  const map = useMap();
  useEffect(() => {
    const activeTourists = (tourists || []).filter(t => t.last_lat && t.last_lng);
    if (activeTourists.length > 0) {
      const bounds = L.latLngBounds(activeTourists.map(t => [t.last_lat, t.last_lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
    }
  }, [tourists, map]);
  return null;
}

const Admin = () => {
  const [tourists, setTourists] = useState([]);
  const [safeZones, setSafeZones] = useState([]);
  const [places, setPlaces] = useState([]);
  
  // States for Search, Zooming, and Forms
  const [mapTarget, setMapTarget] = useState(null);
  const [zoneSearch, setZoneSearch] = useState("");
  const [placeSearch, setPlaceSearch] = useState("");

  const [newPlace, setNewPlace] = useState({ 
    name: '', city: '', img: '', details: '', lat: '', lng: '', type: 'Temple', rating: 4.5, fee: 0 
  });
  const [editPlace, setEditPlace] = useState(null);
  const [newZone, setNewZone] = useState({ name: '', lat: '', lng: '', radius: '', category: 'Safe' });
  const [editZone, setEditZone] = useState(null);

  // --- LOGIC: Filter Lists based on Search Factor ---
  const filteredZones = useMemo(() => 
    (safeZones || []).filter(z => z.name?.toLowerCase().includes(zoneSearch.toLowerCase())), 
  [safeZones, zoneSearch]);

  const filteredPlaces = useMemo(() => 
    (places || []).filter(p => p.name?.toLowerCase().includes(placeSearch.toLowerCase())), 
  [places, placeSearch]);

  // --- LOGIC: Count People currently inside a Geofence ---
  const getPeopleInZoneCount = (zone) => {
    return (tourists || []).filter(t => {
      if (!t.last_lat || !t.last_lng) return false;
      const dist = L.latLng(zone.lat, zone.lng).distanceTo([t.last_lat, t.last_lng]);
      return dist <= zone.radius;
    }).length;
  };

  const stats = {
    danger: (tourists || []).filter(t => t.is_online && (t.current_status?.includes("Danger") || t.current_status?.includes("High Danger"))).length,
    normal: (tourists || []).filter(t => t.is_online && (!t.current_status || t.current_status?.includes("Neutral") || t.current_status?.includes("Safe"))).length
  };

  const fetchData = async (signal) => {
    try {
      const [tRes, zRes, pRes] = await Promise.all([
        fetch('/api/admin/tourists', { signal }),
        fetch('/api/admin/safe-zones', { signal }),
        fetch('/api/places', { signal })
      ]);
      if (tRes.ok) setTourists(await tRes.json());
      if (zRes.ok) setSafeZones(await zRes.json());
      if (pRes.ok) setPlaces(await pRes.json());
    } catch (err) { if (err.name !== 'AbortError') console.error("Fetch error:", err); }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    const interval = setInterval(() => fetchData(controller.signal), 10000);
    return () => { controller.abort(); clearInterval(interval); };
  }, []);

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
    const payload = editPlace ? editPlace : newPlace;
    
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    setEditPlace(null);
    setNewPlace({ name: '', city: '', img: '', details: '', lat: '', lng: '', type: 'Temple', rating: 4.5, fee: 0 });
    fetchData();
  };

  const handleZoneSubmit = async (e) => {
    e.preventDefault();
    const method = editZone ? 'PUT' : 'POST';
    const url = editZone ? `/api/admin/safe-zones/${editZone.id}` : '/api/admin/safe-zones';
    const payload = editZone ? editZone : newZone;

    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    setEditZone(null);
    setNewZone({ name: '', lat: '', lng: '', radius: '', category: 'Safe' });
    fetchData();
  };

  return (
    <Container className="py-5">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="fw-bold text-dark m-0">RakshaSetu Command Center</h2>
        <div className="d-flex gap-3">
            <Badge bg="danger" className="p-2 px-3 shadow-sm fs-6"><ShieldAlert size={18} className="me-2"/> In Danger: {stats.danger}</Badge>
            <Badge bg="success" className="p-2 px-3 shadow-sm fs-6"><Users size={18} className="me-2"/> Normal: {stats.normal}</Badge>
        </div>
      </div>
      
      <Row className="g-4 mb-5">
        <Col lg={8}>
          <div className="auth-card-inner p-0 overflow-hidden" style={{ height: '450px', position: 'relative', zIndex: 1, borderRadius: '15px', border: '1px solid #ddd' }}>
            <MapContainer center={[20.5937, 78.9629]} zoom={5} style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              
              <MapPanTo target={mapTarget} />
              <MapClickHandler onMapClick={handleMapClick} />
              <MapBoundsManager tourists={tourists} />

              {(tourists || []).map(t => t.last_lat && (
                <Marker key={t.id} position={[t.last_lat, t.last_lng]}>
                  <Popup>
                    <strong>{t.username}</strong><br/>
                    Safety: <Badge bg={t.current_status?.includes("High Danger") ? "dark" : t.current_status?.includes("Danger") ? "danger" : "success"}>
                        {t.current_status || "Normal"}
                    </Badge>
                  </Popup>
                </Marker>
              ))}

              {(safeZones || []).map(zone => (
                <Circle 
                  key={zone.id} center={[zone.lat, zone.lng]} radius={zone.radius} 
                  pathOptions={{ 
                    color: zone.category === "High Danger" ? 'black' : 
                           zone.category === "Danger" ? 'red' : 
                           zone.category === "Safe" ? 'yellow' : 'green',
                    fillColor: zone.category === "High Danger" ? 'black' : 
                               zone.category === "Danger" ? 'red' : 
                               zone.category === "Safe" ? 'yellow' : 'green',
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
                <thead><tr><th>User</th><th>Action</th></tr></thead>
                <tbody>
                  {(tourists || []).map(t => (
                    <tr key={t.id}>
                      <td className="align-middle">{t.username}</td>
                      <td>
                        <Button variant="link" className="p-0 text-primary me-2" onClick={() => setMapTarget({lat: t.last_lat, lng: t.last_lng})}><Target size={16}/></Button>
                        <Button variant="link" className="text-danger p-0" onClick={() => { if (window.confirm(`Delete ${t.username}?`)) fetch(`/api/admin/users/${t.id}`, { method: 'DELETE' }).then(() => fetchData()); }}><Trash2 size={16}/></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </div>
        </Col>
      </Row>

      {/* DESTINATIONS WITH SEARCH */}
      <div className="auth-card-inner shadow-sm p-4 mb-5">
        <div className="d-flex justify-content-between mb-3">
          <h5 className="fw-bold m-0"><MapPin size={20} className="me-2"/>Manage Destinations</h5>
          <InputGroup style={{ width: '300px' }}>
            <InputGroup.Text><Search size={16}/></InputGroup.Text>
            <Form.Control placeholder="Search place..." value={placeSearch} onChange={e => setPlaceSearch(e.target.value)} />
          </InputGroup>
        </div>
        <Table responsive striped hover size="sm">
          <thead><tr><th>Name</th><th>City</th><th>Occupancy</th><th>Actions</th></tr></thead>
          <tbody>
            {filteredPlaces.map(p => (
              <tr key={p.id}>
                <td>{p.name}</td><td>{p.city}</td>
                <td><Badge bg="info">{(tourists || []).filter(t => t.last_lat && L.latLng(p.lat, p.lng).distanceTo([t.last_lat, t.last_lng]) < 5000).length} nearby</Badge></td>
                <td>
                  <Button variant="link" onClick={() => setMapTarget({lat: p.lat, lng: p.lng})}><Target size={18}/></Button>
                  <Button variant="link" onClick={() => setEditPlace(p)}><Edit size={16}/></Button>
                  <Button variant="link" className="text-danger" onClick={() => fetch(`/api/admin/places/${p.id}`, {method: 'DELETE'}).then(fetchData)}><Trash2 size={16}/></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      {/* GEOFENCES WITH SEARCH */}
      <div className="auth-card-inner shadow-sm p-4 mb-5">
        <div className="d-flex justify-content-between mb-3">
          <h5 className="fw-bold m-0 text-danger"><ShieldAlert size={20} className="me-2"/>Geofences</h5>
          <InputGroup style={{ width: '300px' }}>
            <InputGroup.Text><Search size={16}/></InputGroup.Text>
            <Form.Control placeholder="Search zone..." value={zoneSearch} onChange={e => setZoneSearch(e.target.value)} />
          </InputGroup>
        </div>
        <Table responsive striped hover size="sm">
          <thead><tr><th>Zone Name</th><th>Category</th><th>Occupancy</th><th>Actions</th></tr></thead>
          <tbody>
            {filteredZones.map(z => (
              <tr key={z.id}>
                <td>{z.name}</td>
                <td><Badge bg={z.category === "High Danger" ? "dark" : z.category === "Danger" ? "danger" : z.category === "Safe" ? "warning" : "success"}>{z.category}</Badge></td>
                <td><Badge bg="secondary">{getPeopleInZoneCount(z)} people</Badge></td>
                <td>
                  <Button variant="outline-primary" size="sm" onClick={() => setMapTarget({lat: z.lat, lng: z.lng})}><Search size={14} className="me-1"/> Zoom</Button>
                  <Button variant="link" className="ms-2" onClick={() => setEditZone(z)}><Edit size={16}/></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      {/* FORMS SECTION */}
      <Row className="g-4">
        <Col md={6}>
          <div className="auth-card-inner shadow-sm p-3">
            <h5 className="fw-bold mb-3"><MapPin size={20} className="me-2"/>{editPlace ? 'Edit Place' : 'Add Place'}</h5>
            <Form onSubmit={handlePlaceSubmit}>
              <Form.Control className="mb-2" placeholder="Name" value={editPlace ? editPlace.name : newPlace.name} onChange={e => editPlace ? setEditPlace({...editPlace, name: e.target.value}) : setNewPlace({...newPlace, name: e.target.value})} required />
              <Form.Control className="mb-2" placeholder="City" value={editPlace ? editPlace.city : newPlace.city} onChange={e => editPlace ? setEditPlace({...editPlace, city: e.target.value}) : setNewPlace({...newPlace, city: e.target.value})} required />
              <Row className="mb-2">
                <Col><Form.Control placeholder="Lat" type="number" step="any" value={editPlace ? editPlace.lat : newPlace.lat} onChange={e => editPlace ? setEditPlace({...editPlace, lat: e.target.value}) : setNewPlace({...newPlace, lat: e.target.value})} required /></Col>
                <Col><Form.Control placeholder="Lng" type="number" step="any" value={editPlace ? editPlace.lng : newPlace.lng} onChange={e => editPlace ? setEditPlace({...editPlace, lng: e.target.value}) : setNewPlace({...newPlace, lng: e.target.value})} required /></Col>
              </Row>
              <Form.Select className="mb-2" value={editPlace ? editPlace.type : newPlace.type} onChange={e => editPlace ? setEditPlace({...editPlace, type: e.target.value}) : setNewPlace({...newPlace, type: e.target.value})}>
                <option value="Temple">Temple</option><option value="Beach">Beach</option><option value="Night Club">Night Club</option><option value="Bar">Bar</option>
              </Form.Select>
              <Button type="submit" className="w-100 btn-pill-gradient border-0">Publish & Generate Zones</Button>
            </Form>
          </div>
        </Col>
        <Col md={6}>
          <div className="auth-card-inner shadow-sm p-3">
            <h5 className="fw-bold mb-3"><ShieldAlert size={20} className="me-2 text-danger"/>{editZone ? 'Edit Zone' : 'Manual Zone'}</h5>
            <Form onSubmit={handleZoneSubmit}>
              <Form.Control className="mb-2" placeholder="Zone Name" value={editZone ? editZone.name : newZone.name} onChange={e => editZone ? setEditZone({...editZone, name: e.target.value}) : setNewZone({...newZone, name: e.target.value})} required />
              <Form.Select className="mb-2" value={editZone ? editZone.category : newZone.category} onChange={e => editZone ? setEditZone({...editZone, category: e.target.value}) : setNewZone({...newZone, category: e.target.value})}>
                <option value="Safe">Safe (Yellow)</option><option value="Neutral">Neutral (Green)</option><option value="Danger">Danger (Red)</option><option value="High Danger">High Danger (Black)</option>
              </Form.Select>
              <Form.Control className="mb-3" placeholder="Radius (meters)" type="number" value={editZone ? editZone.radius : newZone.radius} onChange={e => editZone ? setEditZone({...editZone, radius: e.target.value}) : setNewZone({...newZone, radius: e.target.value})} required />
              <Button type="submit" className="w-100 btn-pill-gradient border-0">Save Geofence</Button>
            </Form>
          </div>
        </Col>
      </Row>
    </Container>
  );
};

export default Admin;