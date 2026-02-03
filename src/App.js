import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MyNavbar from './components/MyNavbar';
import Home from './components/Home';
import Dashboard from './components/Dashboard';
import Auth from './components/Auth';
import 'bootstrap/dist/css/bootstrap.min.css';

function App() {
  // Initialize state using a function to avoid reading localStorage on every render
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('touristUser');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (error) {
      console.error("Failed to parse user from localStorage", error);
      return null;
    }
  });

  // Login handler: Updates both state and persistence layer
  const login = (data) => {
    localStorage.setItem('touristUser', JSON.stringify(data));
    setUser(data);
  };

  // Logout handler: Clears session and state
  const logout = () => {
    localStorage.removeItem('touristUser');
    setUser(null);
  };

  return (
    <Router>
      {/* Navbar receives user state to toggle between Login and Logout buttons */}
      <MyNavbar user={user} onLogout={logout} />
      
      <Routes>
        {/* Public Landing Page */}
        <Route path="/" element={<Home />} />

        {/* Auth Route: Redirects to Dashboard if already logged in */}
        <Route 
          path="/login" 
          element={!user ? <Auth onLogin={login} /> : <Navigate to="/dashboard" replace />} 
        />

        {/* Protected Dashboard: Redirects to Login if session is missing */}
        <Route 
          path="/dashboard" 
          element={user ? <Dashboard user={user} /> : <Navigate to="/login" replace />} 
        />

        {/* Catch-all: Redirects any unknown routes to Home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;