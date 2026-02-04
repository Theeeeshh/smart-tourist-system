import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Modal } from 'react-bootstrap';
import { motion } from 'framer-motion';

const Home = () => {
  const [places, setPlaces] = useState([]);
  const [selectedPlace, setSelectedPlace] = useState(null);

  useEffect(() => {
    // Fetch live places added by Admin
    fetch('/api/places')
      .then(res => res.json())
      .then(data => setPlaces(data))
      .catch(err => console.error("Error fetching places:", err));
  }, []);

  return (
    <Container className="py-5">
      <div className="text-center mb-5">
        <h1 className="display-4 fw-bold">Explore Safe India</h1>
        <p className="text-muted">Discover breathtaking destinations managed by RakshaSetu Admin.</p>
      </div>

      <Row className="g-4">
        {places.map((place) => (
          <Col key={place.id} md={6} lg={3}>
            <motion.div whileHover={{ y: -10 }}>
              <Card className="h-100 border-0 shadow-sm rounded-4 overflow-hidden">
                <Card.Img variant="top" src={place.img} style={{ height: '200px', objectFit: 'cover' }} />
                <Card.Body className="d-flex flex-column">
                  <Card.Title className="fw-bold">{place.name}</Card.Title>
                  <Card.Text className="text-muted small">{place.city}</Card.Text>
                  <Button 
                    className="btn-pill-gradient btn-sm mt-auto" 
                    onClick={() => setSelectedPlace(place)}
                  >
                    View Details
                  </Button>
                </Card.Body>
              </Card>
            </motion.div>
          </Col>
        ))}
      </Row>

      {/* Details Modal */}
      <Modal show={!!selectedPlace} onHide={() => setSelectedPlace(null)} centered>
        <Modal.Header closeButton className="border-0">
          <Modal.Title className="fw-bold">{selectedPlace?.name}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="px-4 pb-4">
          <img src={selectedPlace?.img} className="w-100 rounded-4 mb-3 shadow-sm" alt="place" />
          <p className="text-muted">{selectedPlace?.details}</p>
        </Modal.Body>
      </Modal>
    </Container>
  );
};

export default Home;