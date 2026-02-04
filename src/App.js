import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MyNavbar from './components/MyNavbar';
import Home from './components/Home';
import Dashboard from './components/Dashboard';
import Auth from './components/Auth';
import Landing from './components/Landing';
import Admin from './components/Admin'; 
import { AnimatePresence } from 'framer-motion';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

function App() {
  // Initialize user state from localStorage to persist sessions
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('touristUser');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (error) {
      console.error("Session recovery failed:", error);
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
      <div className="app-container">
        {/* Navbar receives user state to show/hide Login vs Logout buttons */}
        <MyNavbar user={user} onLogout={logout} />
        
        <AnimatePresence mode="wait">
          <Routes>
            {/* 1. Public Landing Page */}
            <Route path="/" element={<Landing />} />
            
            {/* 2. Public Home Page (Places added by Admin appear here) */}
            <Route path="/home" element={<Home />} />
            
            {/* 3. Auth Page (Redirects to Dashboard if already logged in) */}
            <Route 
              path="/login" 
              element={!user ? <Auth onLogin={login} /> : <Navigate to="/dashboard" replace />} 
            />

            {/* 4. Protected Tourist Dashboard (Any logged-in user) */}
            <Route 
              path="/dashboard" 
              element={user ? <Dashboard user={user} /> : <Navigate to="/login" replace />} 
            />

            {/* 5. Protected Admin Command Center (Requires is_admin: true) */}
            <Route 
              path="/admin" 
              element={
                user && user.is_admin ? (
                  <Admin />
                ) : (
                  <Navigate to="/login" replace />
                )
              } 
            />

            {/* Catch-all redirect to Landing */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>
      </div>
    </Router>
  );
}

export default App;