import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Table, Form, Button, Badge } from 'react-bootstrap';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import { Users, MapPin, ShieldAlert, Trash2, Edit } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const Admin = () => {
  const [tourists, setTourists] = useState([]);
  const [safeZones, setSafeZones] = useState([]);
  const [places, setPlaces] = useState([]); // State for existing places
  const [newPlace, setNewPlace] = useState({ name: '', city: '', img: '', details: '' });
  const [editPlace, setEditPlace] = useState(null); // State for editing a place
  const [newZone, setNewZone] = useState({ name: '', lat: '', lng: '', radius: '' });
  const [editZone, setEditZone] = useState(null);

  const fetchData = async () => {
    try {
      const tRes = await fetch('/api/admin/tourists');
      setTourists(await tRes.json());
      const zRes = await fetch('/api/admin/safe-zones');
      setSafeZones(await zRes.json());
      const pRes = await fetch('/api/places'); // Fetch places from public endpoint
      setPlaces(await pRes.json());
    } catch (err) { console.error("Fetch error:", err); }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  // --- PLACE HANDLERS ---
  const handlePlaceSubmit = async (e) => {
    e.preventDefault();
    const method = editPlace ? 'PUT' : 'POST';
    const url = editPlace ? `/api/admin/places/${editPlace.id}` : '/api/admin/places';
    
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editPlace || newPlace)
    });
    
    alert(editPlace ? "Place Updated!" : "Place Published!");
    setEditPlace(null);
    setNewPlace({ name: '', city: '', img: '', details: '' });
    fetchData();
  };

  const deletePlace = async (id) => {
    if (window.confirm("Delete this destination?")) {
      await fetch(`/api/admin/places/${id}`, { method: 'DELETE' });
      fetchData();
    }
  };

  // --- ZONE HANDLERS ---
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

  const deleteLocation = async (username) => {
    await fetch(`/api/admin/tourist-location/${username}`, { method: 'DELETE' });
    fetchData();
  };

  const deleteZone = async (id) => {
    if (window.confirm("Delete this zone?")) {
      await fetch(`/api/admin/safe-zones/${id}`, { method: 'DELETE' });
      fetchData();
    }
  };

  return (
    <Container className="py-5">
      <h2 className="fw-bold mb-4">Admin Command Center</h2>
      
      {/* MAP & ACTIVE TOURISTS SECTION */}
      <Row className="g-4 mb-5">
        <Col lg={8}>
          <div className="auth-card-inner p-0 overflow-hidden" style={{ height: '450px' }}>
            <MapContainer center={[20.5937, 78.9629]} zoom={5} style={{ height: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {tourists.map(t => t.last_lat && (
                <Marker key={t.id} position={[t.last_lat, t.last_lng]}>
                  <Popup>
                    <strong>{t.username}</strong><br/>
                    {t.is_online ? <Badge bg="success">LIVE</Badge> : <Badge bg="secondary">OFFLINE</Badge>}
                  </Popup>
                </Marker>
              ))}
              {safeZones.map(zone => (
                <Circle key={zone.id} center={[zone.lat, zone.lng]} radius={zone.radius} pathOptions={{ color: 'red' }} />
              ))}
            </MapContainer>
          </div>
        </Col>

        <Col lg={4}>
          <div className="auth-card-inner h-100 shadow-sm p-3">
            <h5 className="fw-bold mb-3"><Users size={20}/> Active Tourists</h5>
            <Table hover size="sm">
              <thead><tr><th>Name</th><th>Action</th></tr></thead>
              <tbody>
                {tourists.map(t => (
                  <tr key={t.id}>
                    <td>{t.username} {t.is_online && <Badge bg="success" pill>.</Badge>}</td>
                    <td>
                      <Button variant="link" className="text-danger p-0" onClick={() => deleteLocation(t.username)}><Trash2 size={16}/></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Col>
      </Row>

      {/* PLACES MANAGEMENT SECTION */}
      <Row className="g-4 mb-5">
        <Col md={6}>
          <div className="auth-card-inner shadow-sm p-3">
            <h5 className="fw-bold mb-3"><MapPin size={20}/> {editPlace ? 'Edit Place' : 'Add New Place'}</h5>
            <Form onSubmit={handlePlaceSubmit}>
              <Form.Control className="mb-2" placeholder="Name" value={editPlace ? editPlace.name : newPlace.name} onChange={e => editPlace ? setEditPlace({...editPlace, name: e.target.value}) : setNewPlace({...newPlace, name: e.target.value})} required />
              <Form.Control className="mb-2" placeholder="City" value={editPlace ? editPlace.city : newPlace.city} onChange={e => editPlace ? setEditPlace({...editPlace, city: e.target.value}) : setNewPlace({...newPlace, city: e.target.value})} required />
              <Form.Control className="mb-2" placeholder="Image URL" value={editPlace ? editPlace.img : newPlace.img} onChange={e => editPlace ? setEditPlace({...editPlace, img: e.target.value}) : setNewPlace({...newPlace, img: e.target.value})} required />
              <Form.Control as="textarea" className="mb-3" placeholder="Description" value={editPlace ? editPlace.details : newPlace.details} onChange={e => editPlace ? setEditPlace({...editPlace, details: e.target.value}) : setNewPlace({...newPlace, details: e.target.value})} required />
              <Button type="submit" className="w-100 btn-pill-gradient border-0">{editPlace ? 'Update Place' : 'Publish to Home'}</Button>
              {editPlace && <Button variant="link" className="w-100 mt-1" onClick={() => setEditPlace(null)}>Cancel Edit</Button>}
            </Form>
          </div>
        </Col>
        <Col md={6}>
          <div className="auth-card-inner shadow-sm p-3">
            <h5 className="fw-bold mb-3">Manage Destinations</h5>
            <Table size="sm" striped>
              <thead><tr><th>Place</th><th>City</th><th>Actions</th></tr></thead>
              <tbody>
                {places.map(p => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.city}</td>
                    <td>
                      <Button variant="link" className="p-0 me-2" onClick={() => setEditPlace(p)}><Edit size={16}/></Button>
                      <Button variant="link" className="text-danger p-0" onClick={() => deletePlace(p.id)}><Trash2 size={16}/></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Col>
      </Row>

      {/* SAFE ZONE MANAGEMENT SECTION */}
      <Row className="g-4">
        <Col md={6}>
          <div className="auth-card-inner shadow-sm p-3">
            <h5 className="fw-bold mb-3"><ShieldAlert size={20}/> {editZone ? 'Edit' : 'Define'} Safe Zone</h5>
            <Form onSubmit={handleZoneSubmit}>
              <Form.Control className="mb-2" placeholder="Zone Name" value={editZone ? editZone.name : newZone.name} onChange={e => editZone ? setEditZone({...editZone, name: e.target.value}) : setNewZone({...newZone, name: e.target.value})} required />
              <Row>
                <Col><Form.Control className="mb-2" placeholder="Lat" type="number" step="any" value={editZone ? editZone.lat : newZone.lat} onChange={e => editZone ? setEditZone({...editZone, lat: e.target.value}) : setNewZone({...newZone, lat: e.target.value})} required /></Col>
                <Col><Form.Control className="mb-2" placeholder="Lng" type="number" step="any" value={editZone ? editZone.lng : newZone.lng} onChange={e => editZone ? setEditZone({...editZone, lng: e.target.value}) : setNewZone({...newZone, lng: e.target.value})} required /></Col>
              </Row>
              <Form.Control className="mb-3" placeholder="Radius (meters)" type="number" value={editZone ? editZone.radius : newZone.radius} onChange={e => editZone ? setEditZone({...editZone, radius: e.target.value}) : setNewZone({...newZone, radius: e.target.value})} required />
              <Button type="submit" className="w-100 btn-pill-gradient border-0">{editZone ? 'Update Zone' : 'Create Geofence'}</Button>
              {editZone && <Button variant="link" className="w-100 mt-2" onClick={() => setEditZone(null)}>Cancel Edit</Button>}
            </Form>
          </div>
        </Col>

        <Col md={6}>
          <div className="auth-card-inner shadow-sm p-3">
            <h5 className="fw-bold mb-3">Manage Zones</h5>
            <Table size="sm" striped>
              <thead><tr><th>Name</th><th>Radius</th><th>Actions</th></tr></thead>
              <tbody>
                {safeZones.map(z => (
                  <tr key={z.id}>
                    <td>{z.name}</td>
                    <td>{z.radius}m</td>
                    <td>
                      <Button variant="link" className="p-0 me-2" onClick={() => setEditZone(z)}><Edit size={16}/></Button>
                      <Button variant="link" className="text-danger p-0" onClick={() => deleteZone(z.id)}><Trash2 size={16}/></Button>
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