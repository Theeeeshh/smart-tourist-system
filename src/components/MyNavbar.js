import { Navbar, Nav, Container, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { ShieldCheck, LogIn, LayoutDashboard } from 'lucide-react';

const MyNavbar = ({ user, onLogout }) => (
  <Navbar bg="dark" variant="dark" expand="lg" sticky="top" className="shadow-sm">
    <Container>
      <Navbar.Brand as={Link} to="/" className="fw-bold text-info">
        <ShieldCheck className="me-2" /> RakshaSetu
      </Navbar.Brand>
      <Navbar.Toggle aria-controls="basic-navbar-nav" />
      <Navbar.Collapse id="basic-navbar-nav">
        <Nav className="ms-auto align-items-center">
          <Nav.Link as={Link} to="/">Home</Nav.Link>
          {user ? (
            <>
              <Nav.Link as={Link} to="/dashboard">
                <LayoutDashboard size={18} className="me-1" /> Dashboard
              </Nav.Link>
              <Button variant="outline-light" size="sm" className="ms-lg-3" onClick={onLogout}>Logout</Button>
            </>
          ) : (
            <Button as={Link} to="/login" variant="info" size="sm" className="ms-lg-3">
              <LogIn size={18} className="me-1" /> Login
            </Button>
          )}
        </Nav>
      </Navbar.Collapse>
    </Container>
  </Navbar>
);

export default MyNavbar;