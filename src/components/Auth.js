import React, { useState } from 'react';
import { Container, Card, Form, Button, Alert, Spinner } from 'react-bootstrap';
import { Fingerprint, LogIn, UserPlus } from 'lucide-react';

const Auth = ({ onLogin }) => {
  const [isSignup, setIsSignup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    passport: '' // Used by the backend to generate the SHA-256 Digital ID
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Vercel routes these relative paths to your FastAPI index.py via vercel.json
    const endpoint = isSignup ? '/api/signup' : '/api/login';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        // Successful Auth returns { username, digital_id, access_token }
        onLogin(data); 
      } else {
        // Displays error messages like "Username taken" or "Invalid credentials" from FastAPI
        setError(data.detail || "Authentication failed. Please try again.");
      }
    } catch (err) {
      setError("Connection error. Ensure your backend is deployed and active.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container className="d-flex align-items-center justify-content-center" style={{ minHeight: '80vh' }}>
      <Card className="shadow-lg border-0 p-4" style={{ width: '100%', maxWidth: '400px' }}>
        <div className="text-center mb-4">
          <div className="bg-info d-inline-block p-3 rounded-circle mb-3 shadow-sm">
            <Fingerprint size={32} color="white" />
          </div>
          <h3 className="fw-bold">{isSignup ? 'Create Digital ID' : 'Tourist Login'}</h3>
          <p className="text-muted small">Blockchain-Verified Identity System</p>
        </div>

        {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}

        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label className="small fw-bold">Username</Form.Label>
            <Form.Control 
              type="text" 
              placeholder="Enter username"
              onChange={(e) => setFormData({...formData, username: e.target.value})}
              required 
              disabled={loading}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label className="small fw-bold">Password</Form.Label>
            <Form.Control 
              type="password" 
              placeholder="Enter password"
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              required 
              disabled={loading}
            />
          </Form.Group>

          {isSignup && (
            <Form.Group className="mb-3">
              <Form.Label className="small fw-bold">Passport / Gov ID Number</Form.Label>
              <Form.Control 
                type="text" 
                placeholder="Required for Digital ID generation"
                onChange={(e) => setFormData({...formData, passport: e.target.value})}
                required 
                disabled={loading}
              />
              <Form.Text className="text-muted" style={{ fontSize: '0.7rem' }}>
                Your ID is hashed immediately for privacy and security.
              </Form.Text>
            </Form.Group>
          )}

          <Button 
            variant="info" 
            type="submit" 
            className="w-100 text-white fw-bold py-2 shadow-sm mt-3"
            disabled={loading}
          >
            {loading ? (
              <Spinner animation="border" size="sm" />
            ) : (
              isSignup ? <><UserPlus size={18} className="me-2"/> Register</> : <><LogIn size={18} className="me-2"/> Sign In</>
            )}
          </Button>
        </Form>

        <div className="text-center mt-4">
          <Button 
            variant="link" 
            size="sm" 
            onClick={() => { setIsSignup(!isSignup); setError(''); }} 
            className="text-decoration-none text-info"
          >
            {isSignup ? "Already have a Digital ID? Login" : "New Tourist? Create Blockchain ID"}
          </Button>
        </div>
      </Card>
    </Container>
  );
};

export default Auth;