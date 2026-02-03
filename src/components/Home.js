import { Container, Row, Col, Card, Button } from 'react-bootstrap';

const destinations = [
  { name: "Taj Mahal", city: "Agra", img: "https://images.unsplash.com/photo-1564507592333-c60657451dd6?w=400" },
  { name: "Varanasi Ghats", city: "Varanasi", img: "https://images.unsplash.com/photo-1561361513-2d000a50f0dc?w=400" },
  { name: "Amber Fort", city: "Jaipur", img: "https://images.unsplash.com/photo-1599661046289-e31897846e41?w=400" },
  { name: "Goa Beaches", city: "Goa", img: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=400" }
];

const Home = () => (
  <Container className="py-5">
    <div className="text-center mb-5">
      <h1 className="display-4 fw-bold">Explore Safe India</h1>
      <p className="text-muted">Discover breathtaking destinations with AI-powered safety monitoring.</p>
    </div>
    <Row className="g-4">
      {destinations.map((place, idx) => (
        <Col key={idx} md={6} lg={3}>
          <Card className="h-100 border-0 shadow-sm hover-zoom">
            <Card.Img variant="top" src={place.img} style={{ height: '200px', objectFit: 'cover' }} />
            <Card.Body>
              <Card.Title>{place.name}</Card.Title>
              <Card.Text className="text-muted small">{place.city}</Card.Text>
              <Button variant="outline-primary" size="sm">View Details</Button>
            </Card.Body>
          </Card>
        </Col>
      ))}
    </Row>
  </Container>
);

export default Home;