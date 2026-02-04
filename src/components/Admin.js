import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Table, Form, Button, Badge } from 'react-bootstrap';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import { Users, MapPin, ShieldAlert, Trash2, Edit } from 'lucide-react';

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
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

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
      <h2 className="fw-bold mb-4">Admin Command Center</h2>
      
      {/* Tourists Section */}
      <Row className="g-4 mb-5">
        <Col lg={8}>
          <MapContainer center={[20.5937, 78.9629]} zoom={5} style={{ height: '400px', borderRadius: '15px' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {tourists.map(t => t.last_lat && (
              <Marker key={t.id} position={[t.last_lat, t.last_lng]}>
                <Popup>{t.username} {t.is_online ? '(LIVE)' : '(OFFLINE)'}</Popup>
              </Marker>
            ))}
          </MapContainer>
        </Col>
        <Col lg={4}>
          <div className="auth-card-inner p-3 h-100">
            <h6><Users size={18}/> Active Tourists</h6>
            <Table hover size="sm">
              <tbody>{tourists.map(t => (
                <tr key={t.id}>
                  <td>{t.username} <Badge bg={t.is_online ? "success" : "secondary"}>.</Badge></td>
                  <td>
                    <Button variant="link" className="text-danger p-0" onClick={() => fetch(`/api/admin/tourist-location/${t.username}`, {method:'DELETE'}).then(fetchData)}>
                      <Trash2 size={14}/>
                    </Button>
                  </td>
                </tr>
              ))}</tbody>
            </Table>
          </div>
        </Col>
      </Row>

      {/* Places Management Section */}
      <Row className="g-4">
        <Col md={6}>
          <div className="auth-card-inner p-3">
            <h6><MapPin size={18}/> {editPlace ? 'Edit Place' : 'Add Place'}</h6>
            <Form onSubmit={handlePlaceSubmit}>
              <Form.Control className="mb-2" placeholder="Name" value={editPlace ? editPlace.name : newPlace.name} onChange={e => editPlace ? setEditPlace({...editPlace, name: e.target.value}) : setNewPlace({...newPlace, name: e.target.value})} required />
              <Form.Control className="mb-2" placeholder="City" value={editPlace ? editPlace.city : newPlace.city} onChange={e => editPlace ? setEditPlace({...editPlace, city: e.target.value}) : setNewPlace({...newPlace, city: e.target.value})} required />
              <Button type="submit" className="w-100 btn-pill-gradient border-0">{editPlace ? 'Update' : 'Publish'}</Button>
            </Form>
          </div>
        </Col>
        <Col md={6}>
          <div className="auth-card-inner p-3">
            <h6>Manage Places</h6>
            <Table size="sm" striped>
              <tbody>{places.map(p => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>
                    <Button variant="link" className="p-0 me-2" onClick={() => setEditPlace(p)}><Edit size={14}/></Button>
                    <Button variant="link" className="text-danger p-0" onClick={() => fetch(`/api/admin/places/${p.id}`, {method:'DELETE'}).then(fetchData)}><Trash2 size={14}/></Button>
                  </td>
                </tr>
              ))}</tbody>
            </Table>
          </div>
        </Col>
      </Row>
    </Container>
  );
};

export default Admin;