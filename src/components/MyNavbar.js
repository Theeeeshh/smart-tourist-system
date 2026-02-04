import { Navbar, Nav, Container, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { ShieldCheck, LayoutDashboard, Settings } from 'lucide-react';

const MyNavbar = ({ user, onLogout }) => (
  <Navbar bg="white" expand="lg" sticky="top" className="shadow-sm py-3 px-4 mb-4" style={{ borderRadius: '0 0 20px 20px' }}>
    <Container>
      <Navbar.Brand as={Link} to="/" className="fw-bold text-dark d-flex align-items-center">
        <ShieldCheck className="me-2 text-info" /> RakshaSetu
      </Navbar.Brand>
      <Navbar.Toggle aria-controls="basic-navbar-nav" />
      <Navbar.Collapse id="basic-navbar-nav">
        <Nav className="ms-auto align-items-center">
          <Nav.Link as={Link} to="/home" className="fw-semibold">Home</Nav.Link>
          
          {user && (
            <>
              <Nav.Link as={Link} to="/dashboard" className="fw-semibold">
                <LayoutDashboard size={18} className="me-1" /> Dashboard
              </Nav.Link>
              
              {/* Only show this if the user is an admin */}
              {user.is_admin && (
                <Nav.Link as={Link} to="/admin" className="fw-semibold text-danger">
                  <Settings size={18} className="me-1" /> Admin Panel
                </Nav.Link>
              )}
              
              <Button variant="outline-dark" size="sm" className="ms-lg-3 rounded-pill px-3" onClick={onLogout}>Logout</Button>
            </>
          )}
        </Nav>
      </Navbar.Collapse>
    </Container>
  </Navbar>
);

export default MyNavbar;