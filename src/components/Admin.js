import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Table, Form, Button, Badge } from 'react-bootstrap';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import { motion } from 'framer-motion';
import { Users, MapPin, ShieldAlert } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default Leaflet marker icons
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({ 
  iconUrl: markerIcon, 
  shadowUrl: markerShadow, 
  iconSize: [25, 41], 
  iconAnchor: [12, 41] 
});
L.Marker.prototype.options.icon = DefaultIcon;

const Admin = () => {
  const [tourists, setTourists] = useState([]);
  const [safeZones, setSafeZones] = useState([]);
  const [newPlace, setNewPlace] = useState({ name: '', city: '', img: '', details: '' });
  const [newZone, setNewZone] = useState({ name: '', lat: '', lng: '', radius: '' });

  const fetchData = async () => {
    try {
      const touristRes = await fetch('/api/admin/tourists');
      setTourists(await touristRes.json());
      const zoneRes = await fetch('/api/admin/safe-zones');
      setSafeZones(await zoneRes.json());
    } catch (err) { console.error("Fetch error:", err); }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handlePlaceSubmit = async (e) => {
    e.preventDefault();
    await fetch('/api/admin/places', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPlace)
    });
    alert("Place Published!");
    setNewPlace({ name: '', city: '', img: '', details: '' });
  };

  const handleZoneSubmit = async (e) => {
    e.preventDefault();
    await fetch('/api/admin/safe-zones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newZone)
    });
    alert("Safe Zone Created!");
    setNewZone({ name: '', lat: '', lng: '', radius: '' });
    fetchData();
  };

  return (
    <Container className="py-5">
      <h2 className="fw-bold mb-4 text-dark">Admin Command Center</h2>
      
      <Row className="g-4 mb-5">
        <Col lg={8}>
          <div className="main-glass-outer">
            <div className="auth-card-inner p-0 overflow-hidden" style={{ height: '450px' }}>
              <MapContainer center={[20.5937, 78.9629]} zoom={5} style={{ height: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {tourists.map(t => t.last_lat && (
                  <Marker key={t.id} position={[t.last_lat, t.last_lng]}>
                    <Popup><strong>{t.username}</strong><br/>DID: {t.digital_id}</Popup>
                  </Marker>
                ))}
                {safeZones.map(zone => (
                  <Circle key={zone.id} center={[zone.lat, zone.lng]} radius={zone.radius} pathOptions={{ color: 'red' }} />
                ))}
              </MapContainer>
            </div>
          </div>
        </Col>

        <Col lg={4}>
          <div className="auth-card-inner h-100 shadow-sm">
            <h5 className="fw-bold mb-3"><Users size={20} className="me-2"/>Active Tourists</h5>
            <Table hover size="sm">
              <thead><tr><th>Name</th><th>Status</th></tr></thead>
              <tbody>
                {tourists.map(t => (
                  <tr key={t.id}>
                    <td>{t.username}</td>
                    <td><Badge bg="success">Online</Badge></td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Col>
      </Row>

      <Row className="g-4">
        <Col md={6}>
          <div className="auth-card-inner shadow-sm">
            <h5 className="fw-bold mb-3"><MapPin size={20} className="me-2 text-primary"/>Add New Place</h5>
            <Form onSubmit={handlePlaceSubmit}>
              <Form.Control className="mb-2" placeholder="Name" value={newPlace.name} onChange={e => setNewPlace({...newPlace, name: e.target.value})} required />
              <Form.Control className="mb-2" placeholder="City" value={newPlace.city} onChange={e => setNewPlace({...newPlace, city: e.target.value})} required />
              <Form.Control className="mb-2" placeholder="Image URL" value={newPlace.img} onChange={e => setNewPlace({...newPlace, img: e.target.value})} required />
              <Form.Control as="textarea" className="mb-3" placeholder="Description" value={newPlace.details} onChange={e => setNewPlace({...newPlace, details: e.target.value})} required />
              <Button type="submit" className="btn-pill-gradient w-100 border-0">Publish to Home</Button>
            </Form>
          </div>
        </Col>

        <Col md={6}>
          <div className="auth-card-inner shadow-sm">
            <h5 className="fw-bold mb-3"><ShieldAlert size={20} className="me-2 text-danger"/>Define Safe Zone</h5>
            <Form onSubmit={handleZoneSubmit}>
              <Form.Control className="mb-2" placeholder="Zone Name" value={newZone.name} onChange={e => setNewZone({...newZone, name: e.target.value})} required />
              <Row>
                <Col><Form.Control className="mb-2" placeholder="Lat" type="number" step="any" value={newZone.lat} onChange={e => setNewZone({...newZone, lat: e.target.value})} required /></Col>
                <Col><Form.Control className="mb-2" placeholder="Lng" type="number" step="any" value={newZone.lng} onChange={e => setNewZone({...newZone, lng: e.target.value})} required /></Col>
              </Row>
              <Form.Control className="mb-3" placeholder="Radius (meters)" type="number" value={newZone.radius} onChange={e => setNewZone({...newZone, radius: e.target.value})} required />
              <Button type="submit" className="btn-pill-gradient w-100 border-0" style={{background: 'linear-gradient(90deg, #ff8a71 0%, #ff547b 100%)'}}>Create Geofence</Button>
            </Form>
          </div>
        </Col>
      </Row>
    </Container>
  );
};

export default Admin;