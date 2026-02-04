import React from 'react';
import { Container, Button } from 'react-bootstrap';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const Landing = () => {
  const navigate = useNavigate();

  return (
    <Container className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
      <motion.div 
        className="main-glass-outer text-center"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8 }}
        style={{ width: '100%', maxWidth: '420px' }}
      >
        <div className="auth-card-inner py-5">
          {/* Floating Balloon Icon Animation */}
          <motion.div 
            animate={{ y: [0, -20, 0] }}
            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
            className="app-logo-box mb-4"
            style={{ width: '120px', height: '120px', borderRadius: '30px' }}
          >
            <svg width="60" height="60" viewBox="0 0 24 24" fill="white">
              <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
            </svg>
          </motion.div>

          <h1 className="fw-bold text-dark mb-3">Travel The World With Us</h1>
          <p className="text-muted px-4 mb-5">
            Discover breathtaking destinations with AI-powered safety monitoring and real-time tracking.
          </p>

          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button 
              className="btn-pill-gradient w-75 py-3 fw-bold fs-5"
              onClick={() => navigate('/home')}
            >
              Let's Go!
            </Button>
          </motion.div>
        </div>
      </motion.div>
    </Container>
  );
};

export default Landing;