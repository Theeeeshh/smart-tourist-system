import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Container, Row, Col, Table, Form, Button, Badge, InputGroup, Spinner, Card } from 'react-bootstrap';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents, useMap } from 'react-leaflet';
import { Users, MapPin, ShieldAlert, Trash2, Edit, Search, Target, Plus, X } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Leaflet default icon fix
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({ iconUrl: markerIcon, shadowUrl: markerShadow, iconSize: [25, 41], iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

// Helper: Smooth Panning
function MapPanTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target && target.lat && target.lng) {
      map.flyTo([target.lat, target.lng], 16, { duration: 1.5 });
    }
  }, [target, map]);
  return null;
}

// Helper: Coordinate Selection
function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click: (e) => onMapClick(e.latlng.lat, e.latlng.lng),
  });
  return null;
}

const Admin = () => {
  // Data and UI States
  const [tourists, setTourists] = useState([]);
  const [safeZones, setSafeZones] = useState([]);
  const [places, setPlaces] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mapTarget, setMapTarget] = useState(null);
  const [zoneSearch, setZoneSearch] = useState("");
  const [placeSearch, setPlaceSearch] = useState("");

  // CRUD Form States (Restored and Expanded)
  const defaultPlace = { name: '', city: '', img: '', details: '', lat: '', lng: '', type: 'Temple', rating: 4.5, fee: 0 };
  const [newPlace, setNewPlace] = useState(defaultPlace);
  const [editPlace, setEditPlace] = useState(null);

  const defaultZone = { name: '', lat: '', lng: '', radius: '', category: 'Safe' };
  const [newZone, setNewZone] = useState(defaultZone);
  const [editZone, setEditZone] = useState(null);

  const isFirstRun = useRef(true);

  // Data Fetching Logic (Stabilized)
  const fetchData = async (signal) => {
    if (!isFirstRun.current) setIsRefreshing(true);
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
      }
    } catch (err) { if (err.name !== 'AbortError') console.error("Fetch error:", err); }
    finally { setInitialLoading(false); setIsRefreshing(false); isFirstRun.current = false; }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    const interval = setInterval(() => fetchData(controller.signal), 10000);
    return () => { controller.abort(); clearInterval(interval); };
  }, []);

  // Form Utilities and Submit Handlers
  const handleMapClick = (lat, lng) => {
    const fLat = lat.toFixed(6);
    const fLng = lng.toFixed(6);
    if (editZone) setEditZone({ ...editZone, lat: fLat, lng: fLng });
    else if (editPlace) setEditPlace({ ...editPlace, lat: fLat, lng: fLng });
    else if (newZone.name !== '') setNewZone({ ...newZone, lat: fLat, lng: fLng });
    else setNewPlace({ ...newPlace, lat: fLat, lng: fLng });
  };

  const handlePlaceSubmit = async (e) => {
    e.preventDefault();
    const method = editPlace ? 'PUT' : 'POST';
    const url = editPlace ? `/api/admin/places/${editPlace.id}` : '/api/admin/places';
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editPlace || newPlace) });
    setEditPlace(null); setNewPlace(defaultPlace); fetchData();
  };

  const handleZoneSubmit = async (e) => {
    e.preventDefault();
    const method = editZone ? 'PUT' : 'POST';
    const url = editZone ? `/api/admin/safe-zones/${editZone.id}` : '/api/admin/safe-zones';
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editZone || newZone) });
    setEditZone(null); setNewZone(defaultZone); fetchData();
  };

  const handleDelete = async (type, id) => {
    if (window.confirm(`Delete this ${type}?`)) {
      await fetch(`/api/admin/${type}/${id}`, { method: 'DELETE' });
      fetchData();
    }
  };

  // Memos for Stats and Filtering
  const stats = useMemo(() => ({
    danger: (tourists || []).filter(t => t.is_online && t.current_status?.toLowerCase().includes("danger")).length,
    normal: (tourists || []).filter(t => t.is_online && !t.current_status?.toLowerCase().includes("danger")).length
  }), [tourists]);

  const filteredPlaces = useMemo(() => places.filter(p => p.name.toLowerCase().includes(placeSearch.toLowerCase())), [places, placeSearch]);
  const filteredZones = useMemo(() => safeZones.filter(z => z.name.toLowerCase().includes(zoneSearch.toLowerCase())), [safeZones, zoneSearch]);

  if (initialLoading) return (
    <Container className="d-flex justify-content-center align-items-center" style={{height: '80vh'}}>
      <Spinner animation="border" variant="primary" /><p className="ms-3 fw-bold">Connecting to RakshaSetu...</p>
    </Container>
  );

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between mb-4">
        <h2 className="fw-bold">RakshaSetu Command Center</h2>
        <div className="d-flex gap-2">
            <Badge bg="danger">In Danger: {stats.danger}</Badge>
            <Badge bg="success">Normal: {stats.normal}</Badge>
        </div>
      </div>
      
      {/* Map Section */}
      <Card className="shadow-sm overflow-hidden mb-5" style={{ height: '400px' }}>
        <MapContainer center={[20.5937, 78.9629]} zoom={5} style={{ height: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapPanTo target={mapTarget} /><MapClickHandler onMapClick={handleMapClick} />
          {tourists.map(t => t.last_lat && <Marker key={t.id} position={[t.last_lat, t.last_lng]}><Popup>{t.username} - {t.current_status}</Popup></Marker>)}
          {safeZones.map(z => <Circle key={z.id} center={[z.lat, z.lng]} radius={z.radius} pathOptions={{ color: z.category === 'High Danger' ? 'black' : z.category === 'Danger' ? 'red' : 'green' }} />)}
        </MapContainer>
      </Card>

      {/* QUADRANT LAYOUT START */}
      <Row className="g-4 mb-4">
        
        {/* Q1: Add/Edit Place (Top Left) */}
        <Col md={6}>
          <Card className="shadow-sm h-100">
            <Card.Header className="bg-white border-0"><h5 className="fw-bold m-0"><MapPin/> {editPlace ? "Edit" : "Add"} Place</h5></Card.Header>
            <Card.Body>
              <Form onSubmit={handlePlaceSubmit}>
                <Row className="g-2 mb-2">
                    <Col><Form.Control size="sm" placeholder="Name" value={editPlace?.name || newPlace.name} onChange={e => editPlace ? setEditPlace({...editPlace, name: e.target.value}) : setNewPlace({...newPlace, name: e.target.value})} required/></Col>
                    <Col><Form.Control size="sm" placeholder="City" value={editPlace?.city || newPlace.city} onChange={e => editPlace ? setEditPlace({...editPlace, city: e.target.value}) : setNewPlace({...newPlace, city: e.target.value})}/></Col>
                </Row>
                <Row className="g-2 mb-2">
                  <Col><Form.Control size="sm" placeholder="Lat" value={editPlace?.lat || newPlace.lat} readOnly required/></Col>
                  <Col><Form.Control size="sm" placeholder="Lng" value={editPlace?.lng || newPlace.lng} readOnly required/></Col>
                </Row>
                <Form.Control size="sm" className="mb-2" placeholder="Image URL" value={editPlace?.img || newPlace.img} onChange={e => editPlace ? setEditPlace({...editPlace, img: e.target.value}) : setNewPlace({...newPlace, img: e.target.value})}/>
                <Row className="g-2 mb-2">
                    <Col><Form.Select size="sm" value={editPlace?.type || newPlace.type} onChange={e => editPlace ? setEditPlace({...editPlace, type: e.target.value}) : setNewPlace({...newPlace, type: e.target.value})}><option>Temple</option><option>Beach</option><option>Hill Station</option><option>City</option></Form.Select></Col>
                    <Col><Form.Control size="sm" type="number" step="0.1" placeholder="Rating" value={editPlace?.rating || newPlace.rating} onChange={e => editPlace ? setEditPlace({...editPlace, rating: e.target.value}) : setNewPlace({...newPlace, rating: e.target.value})}/></Col>
                    <Col><Form.Control size="sm" type="number" placeholder="Fee" value={editPlace?.fee || newPlace.fee} onChange={e => editPlace ? setEditPlace({...editPlace, fee: e.target.value}) : setNewPlace({...newPlace, fee: e.target.value})}/></Col>
                </Row>
                <Form.Control size="sm" className="mb-3" as="textarea" rows={3} placeholder="Details..." value={editPlace?.details || newPlace.details} onChange={e => editPlace ? setEditPlace({...editPlace, details: e.target.value}) : setNewPlace({...newPlace, details: e.target.value})}/>
                <Button size="sm" variant="danger" type="submit" className="w-100 rounded-pill">{editPlace ? "Update Place" : "Publish & Auto-Generate Safe Zones"}</Button>
                {editPlace && <Button size="sm" variant="link" className="w-100 text-muted mt-1" onClick={() => setEditPlace(null)}><X size={16}/> Cancel</Button>}
              </Form>
            </Card.Body>
          </Card>
        </Col>

        {/* Q2: Manage Destinations (Top Right) */}
        <Col md={6}>
          <Card className="shadow-sm h-100">
            <Card.Header className="bg-white border-0 d-flex justify-content-between align-items-center"><h5 className="fw-bold m-0">Manage Destinations</h5><InputGroup size="sm" style={{width: '200px'}}><InputGroup.Text><Search size={14}/></InputGroup.Text><Form.Control placeholder="Search..." onChange={e => setPlaceSearch(e.target.value)} /></InputGroup></Card.Header>
            <Card.Body className="p-0 overflow-auto" style={{maxHeight: '350px'}}>
              <Table responsive hover striped size="sm" className="m-0 text-center">
                <thead className="table-light"><tr><th>Name</th><th>City</th><th>Actions</th></tr></thead>
                <tbody>
                  {filteredPlaces.map(p => (
                    <tr key={p.id}><td className="text-start">{p.name}</td><td>{p.city}</td><td>
                      <Button variant="link" size="sm" onClick={() => setMapTarget({lat: p.lat, lng: p.lng})}><Target size={16}/></Button>
                      <Button variant="link" size="sm" className="text-warning" onClick={() => setEditPlace(p)}><Edit size={16}/></Button>
                      <Button variant="link" size="sm" className="text-danger" onClick={() => handleDelete('places', p.id)}><Trash2 size={16}/></Button>
                    </td></tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-4">
        
        {/* Q3: Define Safe Zone (Bottom Left) */}
        <Col md={6}>
          <Card className="shadow-sm h-100">
            <Card.Header className="bg-white border-0"><h5 className="fw-bold m-0 text-danger"><ShieldAlert/> {editZone ? "Edit" : "Define"} Safe Zone</h5></Card.Header>
            <Card.Body>
              <Form onSubmit={handleZoneSubmit}>
                <Form.Control size="sm" className="mb-2" placeholder="Zone Name" value={editZone?.name || newZone.name} onChange={e => editZone ? setEditZone({...editZone, name: e.target.value}) : setNewZone({...newZone, name: e.target.value})} required/>
                <Row className="g-2 mb-2">
                  <Col><Form.Control size="sm" placeholder="Lat" value={editZone?.lat || newZone.lat} readOnly required/></Col>
                  <Col><Form.Control size="sm" placeholder="Lng" value={editZone?.lng || newZone.lng} readOnly required/></Col>
                </Row>
                <Row className="g-2 mb-3">
                  <Col><Form.Control size="sm" placeholder="Radius (meters)" type="number" value={editZone?.radius || newZone.radius} onChange={e => editZone ? setEditZone({...editZone, radius: e.target.value}) : setNewZone({...newZone, radius: e.target.value})} required/></Col>
                  <Col><Form.Select size="sm" value={editZone?.category || newZone.category} onChange={e => editZone ? setEditZone({...editZone, category: e.target.value}) : setNewZone({...newZone, category: e.target.value})}><option>Safe</option><option>Danger</option><option>High Danger</option></Form.Select></Col>
                </Row>
                <Button size="sm" variant="danger" type="submit" className="w-100 rounded-pill">{editZone ? "Update Geofence" : "Create Geofence"}</Button>
                {editZone && <Button size="sm" variant="link" className="w-100 text-muted mt-1" onClick={() => setEditZone(null)}><X size={16}/> Cancel</Button>}
              </Form>
            </Card.Body>
          </Card>
        </Col>

        {/* Q4: Manage Geofences (Bottom Right) */}
        <Col md={6}>
          <Card className="shadow-sm h-100">
            <Card.Header className="bg-white border-0 d-flex justify-content-between align-items-center"><h5 className="fw-bold m-0">Manage Geofences</h5><InputGroup size="sm" style={{width: '200px'}}><InputGroup.Text><Search size={14}/></InputGroup.Text><Form.Control placeholder="Search..." onChange={e => setZoneSearch(e.target.value)} /></InputGroup></Card.Header>
            <Card.Body className="p-0 overflow-auto" style={{maxHeight: '350px'}}>
              <Table responsive hover striped size="sm" className="m-0 text-center">
                <thead className="table-light"><tr><th>Name</th><th>Radius</th><th>Actions</th></tr></thead>
                <tbody>
                  {filteredZones.map(z => (
                    <tr key={z.id}><td className="text-start">{z.name}</td><td>{z.radius}m</td><td>
                      <Button variant="link" size="sm" onClick={() => setMapTarget({lat: z.lat, lng: z.lng})}><Target size={16}/></Button>
                      <Button variant="link" size="sm" className="text-warning" onClick={() => setEditZone(z)}><Edit size={16}/></Button>
                      <Button variant="link" size="sm" className="text-danger" onClick={() => handleDelete('safe-zones', z.id)}><Trash2 size={16}/></Button>
                    </td></tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default Admin;