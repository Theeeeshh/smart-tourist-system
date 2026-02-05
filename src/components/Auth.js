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
    setError('');

    try {
      // 1. If signing up, register the user first
      if (isSignup) {
        const signupResponse = await fetch('/api/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData) // Sends username, password, passport
        });
        
        const signupData = await signupResponse.json();
        
        if (!signupResponse.ok) {
          throw new Error(signupData.detail || "Signup failed");
        }
        // Signup success! Now proceed to login automatically to get the session token.
      }

      // 2. Perform Login (Standard Login OR Auto-Login after Signup)
      // We must send 'passport' even for login because the UserCreate schema 
      // in index.py requires it, otherwise a 422 error occurs.
      const loginResponse = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
          passport: formData.passport || "LOGIN_SESSION" 
        })
      });

      const loginData = await loginResponse.json();

      if (loginResponse.ok) {
        // This ensures App.js state has access_token, username, and digital_id
        onLogin(loginData); 
      } else {
        setError(loginData.detail || "Invalid credentials");
      }
    } catch (err) {
      setError(err.message || "Connection error");
    } finally {
      setLoading(false);
    }
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
            <div className="app-logo-box">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
                <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
              </svg>
            </div>
            <h3 className="fw-bold text-dark">
              {isSignup ? "Create Account" : "Login To Your Account"}
            </h3>
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
                value={formData.username}
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
                value={formData.password}
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
                  value={formData.passport}
                  onChange={(e) => setFormData({...formData, passport: e.target.value})}
                  required={isSignup}
                />
              </Form.Group>
            )}

            <Button type="submit" className="btn-pill-gradient w-100 mt-3" disabled={loading}>
              {loading ? <Spinner size="sm" /> : (isSignup ? 'Register' : 'Login')}
            </Button>

            <div className="text-center mt-3">
              <Button 
                variant="link" 
                size="sm" 
                className="text-muted text-decoration-none" 
                onClick={() => {
                  setIsSignup(!isSignup);
                  setError('');
                }}
              >
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