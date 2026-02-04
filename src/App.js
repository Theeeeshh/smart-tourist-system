import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MyNavbar from './components/MyNavbar';
import Home from './components/Home';
import Dashboard from './components/Dashboard';
import Auth from './components/Auth';
import { motion, AnimatePresence } from 'framer-motion';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

function App() {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('touristUser');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (error) {
      console.error("Failed to parse user from localStorage", error);
      return null;
    }
  });

  const login = (data) => {
    localStorage.setItem('touristUser', JSON.stringify(data));
    setUser(data);
  };

  const logout = () => {
    localStorage.removeItem('touristUser');
    setUser(null);
  };

  return (
    <Router>
      <div className="app-theme-wrapper">
        <MyNavbar user={user} onLogout={logout} />
        
        {/* AnimatePresence allows for smooth exit animations between routes */}
        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route 
              path="/login" 
              element={!user ? <Auth onLogin={login} /> : <Navigate to="/dashboard" replace />} 
            />
            <Route 
              path="/dashboard" 
              element={user ? <Dashboard user={user} /> : <Navigate to="/login" replace />} 
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>
      </div>
    </Router>
  );
}

export default App;