import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Container, Row, Col, Table, Form, Button, Badge, InputGroup, Spinner, Card } from 'react-bootstrap';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents, useMap } from 'react-leaflet';
import { Users, MapPin, ShieldAlert, Trash2, Edit, Search, Target, Plus, X } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default Leaflet marker icons breaking in React
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Helper: Handles Smooth Zooming
function MapPanTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target && target.lat && target.lng) {
      map.flyTo([target.lat, target.lng], 16, { duration: 1.5 });
    }
  }, [target, map]);
  return null;
}

// Helper: Map Clicks for Lat/Lng selection
function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click: (e) => onMapClick(e.latlng.lat, e.latlng.lng),
  });
  return null;
}

const Admin = () => {
  // Data States
  const [tourists, setTourists] = useState([]);
  const [safeZones, setSafeZones] = useState([]);
  const [places, setPlaces] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // UI/Navigation States
  const [mapTarget, setMapTarget] = useState(null);
  const [zoneSearch, setZoneSearch] = useState("");
  const [placeSearch, setPlaceSearch] = useState("");

  // CRUD States (Restored)
  const [newPlace, setNewPlace] = useState({ name: '', city: '', img: '', details: '', lat: '', lng: '', type: 'Temple', rating: 4.5, fee: 0 });
  const [editPlace, setEditPlace] = useState(null);
  const [newZone, setNewZone] = useState({ name: '', lat: '', lng: '', radius: '', category: 'Safe' });
  const [editZone, setEditZone] = useState(null);

  const isFirstRun = useRef(true);

  const fetchData = async (signal) => {
    if (!isFirstRun.current) setIsRefreshing(true);
    try {
      const [tRes, zRes, pRes] = await Promise.all([
        fetch('/api/admin/tourists', { signal }),
        fetch('/api/admin/safe-zones', { signal }),
        fetch('/api/places', { signal })
      ]);
      if (tRes.ok && zRes.ok && pRes.ok) {
        setTourists(await tRes.json());
        setSafeZones(await zRes.json());
        setPlaces(await pRes.json());
      }
    } catch (err) { if (err.name !== 'AbortError') console.error("Fetch error:", err); }
    finally {
      setInitialLoading(false);
      setIsRefreshing(false);
      isFirstRun.current = false;
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    const interval = setInterval(() => fetchData(controller.signal), 10000);
    return () => { controller.abort(); clearInterval(interval); };
  }, []);

  const handleMapClick = (lat, lng) => {
    const fLat = lat.toFixed(6);
    const fLng = lng.toFixed(6);
    if (editZone) setEditZone({ ...editZone, lat: fLat, lng: fLng });
    else if (editPlace) setEditPlace({ ...editPlace, lat: fLat, lng: fLng });
    else if (newZone.name !== '') setNewZone({ ...newZone, lat: fLat, lng: fLng });
    else setNewPlace({ ...newPlace, lat: fLat, lng: fLng });
  };

  const handlePlaceSubmit = async (e) => {
    e.preventDefault();
    const method = editPlace ? 'PUT' : 'POST';
    const url = editPlace ? `/api/admin/places/${editPlace.id}` : '/api/admin/places';
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editPlace || newPlace)
    });
    setEditPlace(null);
    setNewPlace({ name: '', city: '', img: '', details: '', lat: '', lng: '', type: 'Temple', rating: 4.5, fee: 0 });
    fetchData();
  };

  const handleZoneSubmit = async (e) => {
    e.preventDefault();
    const method = editZone ? 'PUT' : 'POST';
    const url = editZone ? `/api/admin/safe-zones/${editZone.id}` : '/api/admin/safe-zones';
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editZone || newZone)
    });
    setEditZone(null);
    setNewZone({ name: '', lat: '', lng: '', radius: '', category: 'Safe' });
    fetchData();
  };

  const handleDelete = async (type, id) => {
    if (window.confirm(`Are you sure you want to delete this ${type}?`)) {
      await fetch(`/api/admin/${type}/${id}`, { method: 'DELETE' });
      fetchData();
    }
  };

  const stats = useMemo(() => ({
    danger: (tourists || []).filter(t => t.is_online && t.current_status?.toLowerCase().includes("danger")).length,
    normal: (tourists || []).filter(t => t.is_online && !t.current_status?.toLowerCase().includes("danger")).length
  }), [tourists]);

  if (initialLoading) {
    return (
      <Container className="d-flex justify-content-center align-items-center" style={{height: '80vh'}}>
        <div className="text-center">
          <Spinner animation="border" variant="primary" />
          <p className="mt-3 fw-bold">RakshaSetu Command Center Syncing...</p>
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="fw-bold m-0">RakshaSetu Command Center</h2>
        <div className="d-flex gap-2">
            <Badge bg="danger" className="p-2">In Danger: {stats.danger}</Badge>
            <Badge bg="success" className="p-2">Normal: {stats.normal}</Badge>
        </div>
      </div>
      
      <Row className="g-4 mb-5">
        <Col lg={8}>
          <Card className="shadow-sm overflow-hidden" style={{ height: '500px' }}>
            <MapContainer center={[20.5937, 78.9629]} zoom={5} style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MapPanTo target={mapTarget} />
              <MapClickHandler onMapClick={handleMapClick} />
              
              {tourists?.map(t => t.last_lat && (
                <Marker key={t.id} position={[t.last_lat, t.last_lng]}>
                  <Popup><strong>{t.username}</strong><br/>Status: {t.current_status || "Online"}</Popup>
                </Marker>
              ))}

              {safeZones?.map(zone => (
                <Circle 
                  key={zone.id} center={[zone.lat, zone.lng]} radius={zone.radius} 
                  pathOptions={{ 
                    color: zone.category === "High Danger" ? 'black' : zone.category === "Danger" ? 'red' : 'green',
                    fillColor: zone.category === "High Danger" ? 'black' : zone.category === "Danger" ? 'red' : 'green',
                    fillOpacity: 0.2 
                  }} 
                />
              ))}
            </MapContainer>
          </Card>
        </Col>

        <Col lg={4}>
          <Card className="shadow-sm p-3 h-100 overflow-auto">
            <h5 className="fw-bold mb-3 border-bottom pb-2">
              {editPlace || editZone ? "Edit Mode" : "Management Console"}
            </h5>
            
            {/* DESTINATION FORM */}
            <Form onSubmit={handlePlaceSubmit} className="mb-4 p-2 bg-light rounded">
              <h6 className="fw-bold"><MapPin size={16}/> {editPlace ? "Edit Destination" : "New Destination"}</h6>
              <Form.Control size="sm" className="mb-1" placeholder="Place Name" value={editPlace?.name || newPlace.name} onChange={e => editPlace ? setEditPlace({...editPlace, name: e.target.value}) : setNewPlace({...newPlace, name: e.target.value})} required />
              <Form.Control size="sm" className="mb-1" placeholder="City" value={editPlace?.city || newPlace.city} onChange={e => editPlace ? setEditPlace({...editPlace, city: e.target.value}) : setNewPlace({...newPlace, city: e.target.value})} />
              <Row className="g-1 mb-1">
                <Col><Form.Control size="sm" placeholder="Lat" value={editPlace?.lat || newPlace.lat} readOnly /></Col>
                <Col><Form.Control size="sm" placeholder="Lng" value={editPlace?.lng || newPlace.lng} readOnly /></Col>
              </Row>
              <Button type="submit" variant="primary" size="sm" className="w-100">{editPlace ? "Update" : "Add"} Place</Button>
            </Form>

            {/* GEOFENCE FORM */}
            <Form onSubmit={handleZoneSubmit} className="p-2 bg-light rounded">
              <h6 className="fw-bold"><ShieldAlert size={16}/> {editZone ? "Edit Geofence" : "New Geofence"}</h6>
              <Form.Control size="sm" className="mb-1" placeholder="Zone Name" value={editZone?.name || newZone.name} onChange={e => editZone ? setEditZone({...editZone, name: e.target.value}) : setNewZone({...newZone, name: e.target.value})} required />
              <Form.Control size="sm" className="mb-1" type="number" placeholder="Radius (meters)" value={editZone?.radius || newZone.radius} onChange={e => editZone ? setEditZone({...editZone, radius: e.target.value}) : setNewZone({...newZone, radius: e.target.value})} required />
              <Form.Select size="sm" className="mb-1" value={editZone?.category || newZone.category} onChange={e => editZone ? setEditZone({...editZone, category: e.target.value}) : setNewZone({...newZone, category: e.target.value})}>
                <option value="Safe">Safe</option>
                <option value="Danger">Danger</option>
                <option value="High Danger">High Danger</option>
              </Form.Select>
              <Button type="submit" variant="danger" size="sm" className="w-100">{editZone ? "Update" : "Add"} Zone</Button>
              {(editPlace || editZone) && <Button variant="secondary" size="sm" className="w-100 mt-1" onClick={() => {setEditPlace(null); setEditZone(null);}}>Cancel</Button>}
            </Form>
          </Card>
        </Col>
      </Row>

      {/* DESTINATIONS LIST */}
      <Card className="shadow-sm p-3 mb-4">
        <div className="d-flex justify-content-between mb-2">
            <h5 className="fw-bold m-0">Destinations</h5>
            <InputGroup size="sm" style={{width: '250px'}}><Form.Control placeholder="Search..." onChange={e => setPlaceSearch(e.target.value)} /></InputGroup>
        </div>
        <Table responsive hover size="sm">
          <thead><tr><th>Name</th><th>City</th><th>Actions</th></tr></thead>
          <tbody>
            {places.filter(p => p.name.toLowerCase().includes(placeSearch.toLowerCase())).map(p => (
              <tr key={p.id}>
                <td>{p.name}</td><td>{p.city}</td>
                <td>
                  <Button variant="link" size="sm" onClick={() => setMapTarget({lat: p.lat, lng: p.lng})}><Target size={16}/></Button>
                  <Button variant="link" size="sm" className="text-warning" onClick={() => setEditPlace(p)}><Edit size={16}/></Button>
                  <Button variant="link" size="sm" className="text-danger" onClick={() => handleDelete('places', p.id)}><Trash2 size={16}/></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {/* GEOFENCES LIST */}
      <Card className="shadow-sm p-3">
        <div className="d-flex justify-content-between mb-2">
            <h5 className="fw-bold m-0">Geofences</h5>
            <InputGroup size="sm" style={{width: '250px'}}><Form.Control placeholder="Search..." onChange={e => setZoneSearch(e.target.value)} /></InputGroup>
        </div>
        <Table responsive hover size="sm">
          <thead><tr><th>Zone Name</th><th>Category</th><th>Actions</th></tr></thead>
          <tbody>
            {safeZones.filter(z => z.name.toLowerCase().includes(zoneSearch.toLowerCase())).map(z => (
              <tr key={z.id}>
                <td>{z.name}</td>
                <td><Badge bg={z.category === 'Danger' ? 'danger' : z.category === 'High Danger' ? 'dark' : 'success'}>{z.category}</Badge></td>
                <td>
                  <Button variant="link" size="sm" onClick={() => setMapTarget({lat: z.lat, lng: z.lng})}><Target size={16}/></Button>
                  <Button variant="link" size="sm" className="text-warning" onClick={() => setEditZone(z)}><Edit size={16}/></Button>
                  <Button variant="link" size="sm" className="text-danger" onClick={() => handleDelete('safe-zones', z.id)}><Trash2 size={16}/></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </Container>
  );
};

export default Admin;