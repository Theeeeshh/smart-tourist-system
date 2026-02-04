import React, { useState } from 'react';
import { Container, Form, Button, Alert, Spinner } from 'react-bootstrap';
import { motion } from 'framer-motion';

const Auth = ({ onLogin }) => {
  const [isSignup, setIsSignup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ username: '', password: '', passport: '' });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const endpoint = isSignup ? '/api/signup' : '/api/login';
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await response.json();
      if (response.ok) onLogin(data);
      else setError(data.detail || "Error occurred");
    } catch (err) {
      setError("Connection error");
    } finally { setLoading(false); }
  };

  return (
    <Container className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
      <motion.div 
        className="main-glass-outer"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        style={{ width: '100%', maxWidth: '420px' }}
      >
        <div className="auth-card-inner">
          <div className="text-center">
            {/* Logo placeholder matching the balloon icon shape */}
            <div className="app-logo-box">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
                <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
              </svg>
            </div>
            <h3 className="fw-bold text-dark">Login To Your Account</h3>
            <p className="text-muted small">Please enter details below</p>
          </div>

          {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}

          <Form onSubmit={handleSubmit} className="mt-4">
            <Form.Group className="mb-3">
              <Form.Label className="small text-muted fw-bold">Username</Form.Label>
              <Form.Control 
                className="form-control-custom"
                type="text" 
                placeholder="Username"
                onChange={(e) => setFormData({...formData, username: e.target.value})}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label className="small text-muted fw-bold">Password</Form.Label>
              <Form.Control 
                className="form-control-custom"
                type="password" 
                placeholder="Password"
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                required
              />
            </Form.Group>

            {isSignup && (
              <Form.Group className="mb-3">
                <Form.Label className="small text-muted fw-bold">Passport ID</Form.Label>
                <Form.Control 
                  className="form-control-custom"
                  type="text" 
                  placeholder="ID Number"
                  onChange={(e) => setFormData({...formData, passport: e.target.value})}
                />
              </Form.Group>
            )}

            <Button type="submit" className="btn-pill-gradient w-100 mt-3" disabled={loading}>
              {loading ? <Spinner size="sm" /> : (isSignup ? 'Register' : 'Login')}
            </Button>

            <div className="text-center mt-3">
              <Button variant="link" size="sm" className="text-muted text-decoration-none" onClick={() => setIsSignup(!isSignup)}>
                {isSignup ? "Have an account? Sign In" : "New tourist? Sign Up"}
              </Button>
            </div>
          </Form>
        </div>
      </motion.div>
    </Container>
  );
};

export default Auth;