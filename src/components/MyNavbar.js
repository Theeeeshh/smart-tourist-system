import { Navbar, Nav, Container, Button } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck, LayoutDashboard, Settings, LogIn, LogOut } from 'lucide-react';

const MyNavbar = ({ user, onLogout }) => {
  const navigate = useNavigate();

  const handleLogoutClick = () => {
    onLogout();
    navigate('/'); // Redirect to landing page after logout
  };

  return (
    <Navbar bg="white" expand="lg" sticky="top" className="shadow-sm py-3 px-4 mb-4" style={{ borderRadius: '0 0 20px 20px' }}>
      <Container>
        {/* Brand Logo */}
        <Navbar.Brand as={Link} to="/" className="fw-bold text-dark d-flex align-items-center">
          <ShieldCheck className="me-2 text-info" size={28} /> 
          <span style={{ letterSpacing: '1px' }}>RakshaSetu</span>
        </Navbar.Brand>

        <Navbar.Toggle aria-controls="basic-navbar-nav" />

        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="ms-auto align-items-center">
            <Nav.Link as={Link} to="/home" className="fw-semibold px-3 text-dark">Home</Nav.Link>
            
            {user ? (
              <>
                <Nav.Link as={Link} to="/dashboard" className="fw-semibold px-3 text-dark d-flex align-items-center">
                  <LayoutDashboard size={18} className="me-1" /> Dashboard
                </Nav.Link>
                
                {/* Admin Role Check */}
                {user.is_admin && (
                  <Nav.Link as={Link} to="/admin" className="fw-semibold px-3 text-danger d-flex align-items-center">
                    <Settings size={18} className="me-1" /> Admin Panel
                  </Nav.Link>
                )}
                
                <Button 
                  variant="outline-dark" 
                  size="sm" 
                  className="ms-lg-3 rounded-pill px-4 fw-bold d-flex align-items-center" 
                  onClick={handleLogoutClick}
                >
                  <LogOut size={16} className="me-2" /> Logout
                </Button>
              </>
            ) : (
              <Button 
                as={Link} 
                to="/login" 
                variant="dark" 
                size="sm" 
                className="ms-lg-3 rounded-pill px-4 fw-bold d-flex align-items-center bg-dark"
              >
                <LogIn size={16} className="me-2" /> Login
              </Button>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default MyNavbar;