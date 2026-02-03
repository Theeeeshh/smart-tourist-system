import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MyNavbar from './components/MyNavbar';
import Home from './components/Home';
import Dashboard from './components/Dashboard';
import Auth from './components/Auth';
import 'bootstrap/dist/css/bootstrap.min.css';

function App() {
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('touristUser')) || null);

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
      <MyNavbar user={user} onLogout={logout} />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={!user ? <Auth onLogin={login} /> : <Navigate to="/dashboard" />} />
        <Route path="/dashboard" element={user ? <Dashboard user={user} /> : <Navigate to="/login" />} />
      </Routes>
    </Router>
  );
}

export default App;