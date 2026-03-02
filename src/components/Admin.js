import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Container, Row, Col, Table, Form, Button, Badge, InputGroup, Spinner, Card, Modal } from 'react-bootstrap';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents, useMap } from 'react-leaflet';
import { Users, MapPin, ShieldAlert, Trash2, Edit, Search, Target, Plus } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Leaflet Icon Fix
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({ iconUrl: markerIcon, shadowUrl: markerShadow, iconSize: [25, 41], iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

function MapPanTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target && target.lat && target.lng) {
      map.flyTo([target.lat, target.lng], 14, { duration: 1.5 });
    }
  }, [target, map]);
  return null;
}

function MapClickHandler({ onMapClick }) {
  useMapEvents({ click: (e) => onMapClick(e.latlng.lat, e.latlng.lng) });
  return null;
}

const Admin = () => {
  const [tourists, setTourists] = useState([]);
  const [safeZones, setSafeZones] = useState([]);
  const [places, setPlaces] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mapTarget, setMapTarget] = useState(null);
  const [zoneSearch, setZoneSearch] = useState("");
  const [placeSearch, setPlaceSearch] = useState("");

  // CRUD States
  const [newPlace, setNewPlace] = useState({ name: '', city: '', img: '', details: '', lat: '', lng: '', type: 'Temple', rating: 4.5, fee: 0 });
  const [editPlace, setEditPlace] = useState(null);
  const [newZone, setNewZone] = useState({ name: '', lat: '', lng: '', radius: '', category: 'Safe' });
  const [editZone, setEditZone] = useState(null);

  const isFirstRun = useRef(true);

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
    } catch (err) { if (err.name !== 'AbortError') console.error(err); }
    finally { setInitialLoading(false); setIsRefreshing(false); isFirstRun.current = false; }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    const interval = setInterval(() => fetchData(controller.signal), 10000);
    return () => { controller.abort(); clearInterval(interval); };
  }, []);

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
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editPlace || newPlace)
    });
    setEditPlace(null);
    setNewPlace({ name: '', city: '', img: '', details: '', lat: '', lng: '', type: 'Temple', rating: 4.5, fee: 0 });
    fetchData();
  };

  const handleDelete = async (type, id) => {
    if (!window.confirm("Are you sure?")) return;
    await fetch(`/api/admin/${type}/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const stats = useMemo(() => ({
    danger: (tourists || []).filter(t => t.is_online && t.current_status?.toLowerCase().includes("danger")).length,
    normal: (tourists || []).filter(t => t.is_online && !t.current_status?.toLowerCase().includes("danger")).length
  }), [tourists]);

  if (initialLoading) return (
    <Container className="d-flex justify-content-center align-items-center" style={{height: '80vh'}}>
      <Spinner animation="grow" variant="primary" /><p className="ms-3 fw-bold">RakshaSetu Booting...</p>
    </Container>
  );

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between mb-4">
        <h2 className="fw-bold">🚀 Command Center</h2>
        <div className="d-flex gap-2">
          <Badge bg="danger">Danger: {stats.danger}</Badge>
          <Badge bg="success">Normal: {stats.normal}</Badge>
        </div>
      </div>

      <Row className="mb-4 g-3">
        <Col lg={8}>
          <Card className="shadow-sm overflow-hidden" style={{ height: '450px' }}>
            <MapContainer center={[20.5937, 78.9629]} zoom={5} style={{ height: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MapPanTo target={mapTarget} />
              <MapClickHandler onMapClick={handleMapClick} />
              {tourists.map(t => t.last_lat && (
                <Marker key={t.id} position={[t.last_lat, t.last_lng]}>
                  <Popup>{t.username} - {t.current_status}</Popup>
                </Marker>
              ))}
              {safeZones.map(z => (
                <Circle key={z.id} center={[z.lat, z.lng]} radius={z.radius} pathOptions={{ color: z.category === 'Danger' ? 'red' : 'green' }} />
              ))}
            </MapContainer>
          </Card>
        </Col>
        
        {/* ADD PLACE FORM */}
        <Col lg={4}>
          <Card className="shadow-sm p-3 h-100">
            <h5 className="fw-bold"><Plus size={18}/> {editPlace ? "Edit" : "Add"} Destination</h5>
            <Form onSubmit={handlePlaceSubmit}>
              <Form.Control className="mb-2" size="sm" placeholder="Name" value={editPlace?.name || newPlace.name} onChange={e => editPlace ? setEditPlace({...editPlace, name: e.target.value}) : setNewPlace({...newPlace, name: e.target.value})} required />
              <Row><Col><Form.Control className="mb-2" size="sm" placeholder="Lat" value={editPlace?.lat || newPlace.lat} readOnly /></Col>
              <Col><Form.Control className="mb-2" size="sm" placeholder="Lng" value={editPlace?.lng || newPlace.lng} readOnly /></Col></Row>
              <Form.Control className="mb-2" size="sm" placeholder="Image URL" value={editPlace?.img || newPlace.img} onChange={e => editPlace ? setEditPlace({...editPlace, img: e.target.value}) : setNewPlace({...newPlace, img: e.target.value})} />
              <Form.Control as="textarea" rows={2} className="mb-2" size="sm" placeholder="Details" value={editPlace?.details || newPlace.details} onChange={e => editPlace ? setEditPlace({...editPlace, details: e.target.value}) : setNewPlace({...newPlace, details: e.target.value})} />
              <Button type="submit" variant="primary" size="sm" className="w-100">{editPlace ? "Update" : "Save"} Destination</Button>
              {editPlace && <Button variant="link" size="sm" className="w-100 mt-1" onClick={() => setEditPlace(null)}>Cancel</Button>}
            </Form>
          </Card>
        </Col>
      </Row>

      {/* PLACES TABLE */}
      <Card className="mb-4 shadow-sm p-3">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 className="m-0"><MapPin size={20}/> Destinations</h5>
          <InputGroup size="sm" style={{width: '250px'}}><InputGroup.Text><Search size={14}/></InputGroup.Text><Form.Control placeholder="Search..." onChange={e => setPlaceSearch(e.target.value)} /></InputGroup>
        </div>
        <Table responsive hover size="sm">
          <thead><tr><th>Name</th><th>City</th><th>Actions</th></tr></thead>
          <tbody>
            {places.filter(p => p.name.toLowerCase().includes(placeSearch.toLowerCase())).map(p => (
              <tr key={p.id}>
                <td>{p.name}</td><td>{p.city}</td>
                <td>
                  <Button variant="link" onClick={() => setMapTarget({lat: p.lat, lng: p.lng})}><Target size={16}/></Button>
                  <Button variant="link" className="text-warning" onClick={() => setEditPlace(p)}><Edit size={16}/></Button>
                  <Button variant="link" className="text-danger" onClick={() => handleDelete('places', p.id)}><Trash2 size={16}/></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {/* GEOFENCE TABLE */}
      <Card className="shadow-sm p-3">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 className="m-0 text-danger"><ShieldAlert size={20}/> Geofences</h5>
          <InputGroup size="sm" style={{width: '250px'}}><InputGroup.Text><Search size={14}/></InputGroup.Text><Form.Control placeholder="Search..." onChange={e => setZoneSearch(e.target.value)} /></InputGroup>
        </div>
        <Table responsive hover size="sm">
          <thead><tr><th>Zone</th><th>Category</th><th>Actions</th></tr></thead>
          <tbody>
            {safeZones.filter(z => z.name.toLowerCase().includes(zoneSearch.toLowerCase())).map(z => (
              <tr key={z.id}>
                <td>{z.name}</td>
                <td><Badge bg={z.category === 'Danger' ? 'danger' : 'success'}>{z.category}</Badge></td>
                <td>
                  <Button variant="link" onClick={() => setMapTarget({lat: z.lat, lng: z.lng})}><Target size={16}/></Button>
                  <Button variant="link" className="text-danger" onClick={() => handleDelete('safe-zones', z.id)}><Trash2 size={16}/></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </Container>
  );
};

export default Admin;