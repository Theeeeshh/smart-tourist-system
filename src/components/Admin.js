import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Table, Form, Button, Badge } from 'react-bootstrap';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents, useMap } from 'react-leaflet';
import { Users, MapPin, ShieldAlert, Trash2, Edit } from 'lucide-react';
import L from 'leaflet';

// Essential CSS for map tile alignment
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

// Helper component to handle map clicks for coordinate selection
function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Automatically pans the map to fit all active tourists
function MapBoundsManager({ tourists }) {
  const map = useMap();
  useEffect(() => {
    const activeTourists = tourists.filter(t => t.last_lat && t.last_lng);
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
  
  const [newPlace, setNewPlace] = useState({ name: '', city: '', img: '', details: '' });
  const [editPlace, setEditPlace] = useState(null);
  
  const [newZone, setNewZone] = useState({ name: '', lat: '', lng: '', radius: '' });
  const [editZone, setEditZone] = useState(null);

  const fetchData = async () => {
    try {
      const tRes = await fetch('/api/admin/tourists');
      setTourists(await tRes.json());
      const zRes = await fetch('/api/admin/safe-zones');
      setSafeZones(await zRes.json());
      const pRes = await fetch('/api/places');
      setPlaces(await pRes.json());
    } catch (err) { console.error("Fetch error:", err); }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleMapClick = (lat, lng) => {
    const formattedLat = lat.toFixed(6);
    const formattedLng = lng.toFixed(6);
    if (editZone) {
      setEditZone({ ...editZone, lat: formattedLat, lng: formattedLng });
    } else {
      setNewZone({ ...newZone, lat: formattedLat, lng: formattedLng });
    }
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
    setNewPlace({ name: '', city: '', img: '', details: '' });
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
    setNewZone({ name: '', lat: '', lng: '', radius: '' });
    fetchData();
  };

  return (
    <Container className="py-5">
      <h2 className="fw-bold mb-4 text-dark">Admin Command Center</h2>
      
      <Row className="g-4 mb-5">
        <Col lg={8}>
          <div className="auth-card-inner p-0 overflow-hidden" style={{ height: '450px', position: 'relative', zIndex: 1, borderRadius: '15px' }}>
            <MapContainer center={[20.5937, 78.9629]} zoom={5} style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MapClickHandler onMapClick={handleMapClick} />
              <MapBoundsManager tourists={tourists} />
              {tourists.map(t => t.last_lat && (
                <Marker key={t.id} position={[t.last_lat, t.last_lng]}>
                  <Popup>
                    <strong>{t.username}</strong><br/>
                    Status: {t.is_online ? <Badge bg="success">Live</Badge> : <Badge bg="secondary">Offline</Badge>}
                  </Popup>
                </Marker>
              ))}
              {safeZones.map(zone => (
                <Circle key={zone.id} center={[zone.lat, zone.lng]} radius={zone.radius} pathOptions={{ color: 'red', fillColor: 'red', fillOpacity: 0.2 }} />
              ))}
            </MapContainer>
            <div className="bg-light p-2 text-center small text-muted border-top">
              Tap the map or enter coordinates manually below.
            </div>
          </div>
        </Col>

        <Col lg={4}>
          <div className="auth-card-inner h-100 shadow-sm p-3">
            <h5 className="fw-bold mb-3"><Users size={20} className="me-2"/>Active Tourists</h5>
            <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
              <Table hover size="sm">
                <thead><tr><th>User</th><th>Action</th></tr></thead>
                <tbody>
                  {tourists.map(t => (
                    <tr key={t.id}>
                      <td className="align-middle">
                        {t.username} <Badge bg={t.is_online ? "success" : "secondary"} pill className="ms-1">.</Badge>
                      </td>
                      <td>
                        <Button variant="link" className="text-danger p-0" onClick={() => fetch(`/api/admin/tourist-location/${t.username}`, {method: 'DELETE'}).then(fetchData)}>
                          <Trash2 size={16}/>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </div>
        </Col>
      </Row>

      {/* PLACES MANAGEMENT */}
      <Row className="g-4 mb-5">
        <Col md={6}>
          <div className="auth-card-inner shadow-sm p-3">
            <h5 className="fw-bold mb-3"><MapPin size={20} className="me-2"/>{editPlace ? 'Edit Place' : 'Add Place'}</h5>
            <Form onSubmit={handlePlaceSubmit}>
              <Form.Control className="mb-2" placeholder="Name" value={editPlace ? editPlace.name : newPlace.name} onChange={e => editPlace ? setEditPlace({...editPlace, name: e.target.value}) : setNewPlace({...newPlace, name: e.target.value})} required />
              <Form.Control className="mb-2" placeholder="City" value={editPlace ? editPlace.city : newPlace.city} onChange={e => editPlace ? setEditPlace({...editPlace, city: e.target.value}) : setNewPlace({...newPlace, city: e.target.value})} required />
              <Form.Control className="mb-2" placeholder="Image URL" value={editPlace ? editPlace.img : newPlace.img} onChange={e => editPlace ? setEditPlace({...editPlace, img: e.target.value}) : setNewPlace({...newPlace, img: e.target.value})} required />
              <Form.Control as="textarea" rows={2} className="mb-3" placeholder="Details" value={editPlace ? editPlace.details : newPlace.details} onChange={e => editPlace ? setEditPlace({...editPlace, details: e.target.value}) : setNewPlace({...newPlace, details: e.target.value})} required />
              <Button type="submit" className="w-100 btn-pill-gradient border-0">{editPlace ? 'Update Destination' : 'Publish Destination'}</Button>
              {editPlace && <Button variant="link" className="w-100 mt-1 text-secondary" onClick={() => { setEditPlace(null); setNewPlace({name:'', city:'', img:'', details:''}); }}>Cancel Update</Button>}
            </Form>
          </div>
        </Col>
        <Col md={6}>
          <div className="auth-card-inner shadow-sm p-3">
            <h5 className="fw-bold mb-3">Manage Destinations</h5>
            <Table size="sm" striped hover>
              <thead><tr><th>Name</th><th>City</th><th>Actions</th></tr></thead>
              <tbody>
                {places.map(p => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.city}</td>
                    <td>
                      <Button variant="link" className="p-0 me-2" onClick={() => setEditPlace(p)}><Edit size={16}/></Button>
                      <Button variant="link" className="text-danger p-0" onClick={() => fetch(`/api/admin/places/${p.id}`, {method: 'DELETE'}).then(fetchData)}><Trash2 size={16}/></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Col>
      </Row>

      {/* SAFE ZONE MANAGEMENT - MANUAL UPDATE ENABLED */}
      <Row className="g-4">
        <Col md={6}>
          <div className="auth-card-inner shadow-sm p-3">
            <h5 className="fw-bold mb-3"><ShieldAlert size={20} className="me-2 text-danger"/>{editZone ? 'Edit Zone' : 'Define Safe Zone'}</h5>
            <Form onSubmit={handleZoneSubmit}>
              <Form.Control className="mb-2" placeholder="Zone Name" value={editZone ? editZone.name : newZone.name} onChange={e => editZone ? setEditZone({...editZone, name: e.target.value}) : setNewZone({...newZone, name: e.target.value})} required />
              <Row>
                <Col>
                  <Form.Control 
                    className="mb-2" 
                    placeholder="Lat" 
                    type="number" 
                    step="any" 
                    value={editZone ? editZone.lat : newZone.lat} 
                    onChange={e => editZone ? setEditZone({...editZone, lat: e.target.value}) : setNewZone({...newZone, lat: e.target.value})} 
                    required 
                  />
                </Col>
                <Col>
                  <Form.Control 
                    className="mb-2" 
                    placeholder="Lng" 
                    type="number" 
                    step="any" 
                    value={editZone ? editZone.lng : newZone.lng} 
                    onChange={e => editZone ? setEditZone({...editZone, lng: e.target.value}) : setNewZone({...newZone, lng: e.target.value})} 
                    required 
                  />
                </Col>
              </Row>
              <Form.Control className="mb-3" placeholder="Radius (meters)" type="number" value={editZone ? editZone.radius : newZone.radius} onChange={e => editZone ? setEditZone({...editZone, radius: e.target.value}) : setNewZone({...newZone, radius: e.target.value})} required />
              <Button type="submit" className="w-100 btn-pill-gradient border-0">{editZone ? 'Update Zone' : 'Create Geofence'}</Button>
              {editZone && <Button variant="link" className="w-100 mt-1 text-secondary" onClick={() => { setEditZone(null); setNewZone({name:'', lat:'', lng:'', radius:''}); }}>Cancel Update</Button>}
            </Form>
          </div>
        </Col>
        <Col md={6}>
          <div className="auth-card-inner shadow-sm p-3">
            <h5 className="fw-bold mb-3">Manage Geofences</h5>
            <Table size="sm" striped hover>
              <thead><tr><th>Name</th><th>Radius</th><th>Actions</th></tr></thead>
              <tbody>
                {safeZones.map(z => (
                  <tr key={z.id}>
                    <td>{z.name}</td>
                    <td>{z.radius}m</td>
                    <td>
                      <Button variant="link" className="p-0 me-2" onClick={() => setEditZone(z)}><Edit size={16}/></Button>
                      <Button variant="link" className="text-danger p-0" onClick={() => fetch(`/api/admin/safe-zones/${z.id}`, {method: 'DELETE'}).then(fetchData)}><Trash2 size={16}/></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Col>
      </Row>
    </Container>
  );
};

export default Admin;