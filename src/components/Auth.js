import React, { useState } from 'react';
import { Container, Card, Form, Button, Alert, Spinner, InputGroup } from 'react-bootstrap';
import { Fingerprint, LogIn, UserPlus, Eye, EyeOff } from 'lucide-react';

const Auth = ({ onLogin }) => {
  const [isSignup, setIsSignup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false); // Toggle state
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({ username: '', password: '', passport: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const endpoint = isSignup ? '/api/signup' : '/api/login';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await response.json();
      if (response.ok) { onLogin(data); } 
      else { setError(data.detail || "Authentication failed."); }
    } catch (err) {
      setError("Connection error. Ensure your backend is active.");
    } finally { setLoading(false); }
  };

  return (
    <Container className="d-flex align-items-center justify-content-center" style={{ minHeight: '80vh' }}>
      <Card className="shadow-lg border-0 p-4 w-100" style={{ maxWidth: '400px' }}>
        <div className="text-center mb-4">
          <div className="bg-info d-inline-block p-3 rounded-circle mb-3 shadow-sm">
            <Fingerprint size={32} color="white" />
          </div>
          <h3 className="fw-bold">{isSignup ? 'Create Digital ID' : 'Tourist Login'}</h3>
        </div>

        {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}

        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label className="small fw-bold">Username</Form.Label>
            <Form.Control 
              type="text" 
              onChange={(e) => setFormData({...formData, username: e.target.value})}
              required disabled={loading}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label className="small fw-bold">Password</Form.Label>
            <InputGroup>
              <Form.Control 
                type={showPassword ? "text" : "password"} // Conditional type
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                required disabled={loading}
              />
              <Button 
                variant="outline-secondary" 
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </Button>
            </InputGroup>
          </Form.Group>

          {isSignup && (
            <Form.Group className="mb-3">
              <Form.Label className="small fw-bold">Passport / Gov ID</Form.Label>
              <Form.Control 
                type="text" 
                onChange={(e) => setFormData({...formData, passport: e.target.value})}
                required disabled={loading}
              />
            </Form.Group>
          )}

          <Button variant="info" type="submit" className="w-100 text-white fw-bold py-2 mt-3" disabled={loading}>
            {loading ? <Spinner size="sm" /> : (isSignup ? 'Register' : 'Sign In')}
          </Button>
        </Form>
      </Card>
    </Container>
  );
};

export default Auth;