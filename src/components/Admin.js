import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Table, Form, Button, Badge } from 'react-bootstrap';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { motion } from 'framer-motion';
import { Users, MapPin } from 'lucide-react';

const Admin = () => {
  const [tourists, setTourists] = useState([]);
  const [newPlace, setNewPlace] = useState({ name: '', city: '', img: '', details: '' });

  useEffect(() => {
    const fetchTourists = () => {
      fetch('/api/admin/tourists')
        .then(res => res.json())
        .then(data => setTourists(data));
    };
    fetchTourists();
    const interval = setInterval(fetchTourists, 5000); // Live update every 5 seconds
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
  };

  return (
    <Container className="py-5">
      <h2 className="fw-bold mb-4 text-dark">Admin Command Center</h2>
      
      <Row className="g-4">
        {/* Live Tracking Map */}
        <Col lg={8}>
          <div className="main-glass-outer">
            <div className="auth-card-inner p-0 overflow-hidden" style={{ height: '450px' }}>
              <MapContainer center={[20.5937, 78.9629]} zoom={5} style={{ height: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {tourists.map(t => t.last_lat && (
                  <Marker key={t.id} position={[t.last_lat, t.last_lng]}>
                    <Popup>
                      <strong>{t.username}</strong><br/>DID: {t.digital_id}
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </div>
        </Col>

        {/* Tourist List */}
        <Col lg={4}>
          <div className="auth-card-inner">
            <h5 className="fw-bold mb-3"><Users size={20} className="me-2"/>Active Tourists</h5>
            <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
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
          </div>
        </Col>

        {/* Add Content Form */}
        <Col md={6}>
          <motion.div className="auth-card-inner" whileHover={{ y: -5 }}>
            <h5 className="fw-bold mb-3"><MapPin size={20} className="me-2 text-primary"/>Add New Place</h5>
            <Form onSubmit={handlePlaceSubmit}>
              <Form.Control className="mb-2" placeholder="Name" onChange={e => setNewPlace({...newPlace, name: e.target.value})} />
              <Form.Control className="mb-2" placeholder="City" onChange={e => setNewPlace({...newPlace, city: e.target.value})} />
              <Form.Control className="mb-2" placeholder="Image URL" onChange={e => setNewPlace({...newPlace, img: e.target.value})} />
              <Form.Control as="textarea" className="mb-3" placeholder="Description" onChange={e => setNewPlace({...newPlace, details: e.target.value})} />
              <Button type="submit" className="btn-pill-gradient w-100">Publish to Home</Button>
            </Form>
          </motion.div>
        </Col>
      </Row>
    </Container>
  );
};

export default Admin;