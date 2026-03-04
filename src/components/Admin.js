import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Container, Row, Col, Table, Form, Button, Badge, InputGroup, Spinner, Card } from 'react-bootstrap';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents, useMap } from 'react-leaflet';
import { Users, MapPin, ShieldAlert, Trash2, Edit, Search, Target, Plus, X } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default Leaflet marker icons breaking in React
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({ iconUrl: markerIcon, shadowUrl: markerShadow, iconSize: [25, 41], iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

// Helper: Smooth Panning with Debounce (Wait for typing to pause)
function MapPanTo({ position }) {
  const map = useMap();
  useEffect(() => {
    if (!position || isNaN(position[0]) || isNaN(position[1])) return;
    
    // Wait 500ms after the last keystroke before panning the map
    const timeoutId = setTimeout(() => {
      map.panTo(position, { animate: true, duration: 0.8 });
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [position, map]);
  return null;
}

// Helper: Coordinate Selection
function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click: (e) => onMapClick(e.latlng.lat, e.latlng.lng),
  });
  return null;
}

const Admin = () => {
  const [tourists, setTourists] = useState([]);
  const [safeZones, setSafeZones] = useState([]);
  const [places, setPlaces] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  
  const [placeSearch, setPlaceSearch] = useState("");
  const [zoneSearch, setZoneSearch] = useState("");

  // CRUD States
  const defaultPlace = { name: '', city: '', img: '', details: '', lat: '', lng: '', type: 'Temple', rating: 4.5, fee: 0 };
  const [newPlace, setNewPlace] = useState(defaultPlace);
  const [editPlace, setEditPlace] = useState(null);

  const defaultZone = { name: '', lat: '', lng: '', radius: 500, category: 'Safe' };
  const [newZone, setNewZone] = useState(defaultZone);
  const [editZone, setEditZone] = useState(null);

  const fetchData = async () => {
    try {
      const [tRes, zRes, pRes] = await Promise.all([
        fetch('/api/admin/tourists'),
        fetch('/api/admin/safe-zones'),
        fetch('/api/places')
      ]);
      if (tRes.ok && zRes.ok && pRes.ok) {
        setTourists(await tRes.json());
        setSafeZones(await zRes.json());
        setPlaces(await pRes.json());
      }
    } catch (err) { console.error("Sync Error:", err); }
    finally { setInitialLoading(false); }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); 
    return () => clearInterval(interval);
  }, []);

  const handleMapClick = (lat, lng) => {
    const fLat = lat.toFixed(6);
    const fLng = lng.toFixed(6);
    if (editPlace) setEditPlace({ ...editPlace, lat: fLat, lng: fLng });
    else if (editZone) setEditZone({ ...editZone, lat: fLat, lng: fLng });
    else if (newZone.name !== '') setNewZone({ ...newZone, lat: fLat, lng: fLng });
    else setNewPlace({ ...newPlace, lat: fLat, lng: fLng });
  };

  const handlePlaceSubmit = async (e) => {
    e.preventDefault();
    const method = editPlace ? 'PUT' : 'POST';
    const url = editPlace ? `/api/admin/places/${editPlace.id}` : '/api/admin/places';
    
    const payload = {
        ...(editPlace || newPlace),
        lat: parseFloat((editPlace || newPlace).lat),
        lng: parseFloat((editPlace || newPlace).lng),
    };

    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    setEditPlace(null);
    setNewPlace(defaultPlace);
    fetchData();
  };

  const handleZoneSubmit = async (e) => {
    e.preventDefault();
    const payload = {
        ...newZone,
        lat: parseFloat(newZone.lat),
        lng: parseFloat(newZone.lng),
    };

    await fetch('/api/admin/safe-zones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    setNewZone(defaultZone);
    fetchData();
  };

  const handleDelete = async (type, id) => {
    if (window.confirm(`Permanently delete this ${type}?`)) {
      await fetch(`/api/admin/${type}/${id}`, { method: 'DELETE' });
      fetchData();
    }
  };

  // NEW: Determine the active draft coordinates for the live marker
  // It follows the same priority as your handleMapClick function.
  let draftLat = NaN, draftLng = NaN;
  if (editPlace && editPlace.lat !== '') {
    draftLat = parseFloat(editPlace.lat); draftLng = parseFloat(editPlace.lng);
  } else if (editZone && editZone.lat !== '') {
    draftLat = parseFloat(editZone.lat); draftLng = parseFloat(editZone.lng);
  } else if (newZone.lat !== '') {
    draftLat = parseFloat(newZone.lat); draftLng = parseFloat(newZone.lng);
  } else if (newPlace.lat !== '') {
    draftLat = parseFloat(newPlace.lat); draftLng = parseFloat(newPlace.lng);
  }
  const previewPosition = (!isNaN(draftLat) && !isNaN(draftLng)) ? [draftLat, draftLng] : null;

  if (initialLoading) return (
    <Container className="d-flex justify-content-center align-items-center" style={{height: '100vh'}}>
      <Spinner animation="grow" variant="danger" />
    </Container>
  );

  return (
    <Container fluid className="py-4 px-5" style={{ background: 'linear-gradient(135deg, #fff5f5 0%, #f0f4ff 100%)', minHeight: '100vh' }}>
      <Row className="mb-4">
        <Col>
          <Card className="shadow-sm border-0 rounded-4 overflow-hidden" style={{ height: '400px' }}>
            <MapContainer center={[20.5937, 78.9629]} zoom={5} style={{ height: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              
              <MapClickHandler onMapClick={handleMapClick} />
              
              {/* Dynamic Panning to typed coordinates */}
              <MapPanTo position={previewPosition} />

              {/* NEW: Live Interactive Draft Marker */}
              {previewPosition && (
                <>
                  <Marker position={previewPosition} opacity={0.8}>
                    <Popup>📍 <strong>Draft Location</strong><br/>Updates as you type!</Popup>
                  </Marker>
                  {/* Adds a cool dashed ring around the draft marker so it stands out */}
                  <Circle 
                    center={previewPosition} 
                    radius={1500} 
                    pathOptions={{ color: '#0d6efd', fillOpacity: 0.1, dashArray: '5, 10' }} 
                  />
                </>
              )}
              
              {/* Existing Tourists */}
              {tourists.map(t => {
                const lat = parseFloat(t.last_lat);
                const lng = parseFloat(t.last_lng);
                if (isNaN(lat) || isNaN(lng)) return null;
                return (
                  <Marker key={t.id} position={[lat, lng]}>
                    <Popup><strong>{t.username}</strong><br/>{t.is_online ? "🟢 Online" : "⚪ Offline"}</Popup>
                  </Marker>
                );
              })}

              {/* Existing Safe Zones */}
              {safeZones.map(z => {
                const lat = parseFloat(z.lat);
                const lng = parseFloat(z.lng);
                if (isNaN(lat) || isNaN(lng)) return null;
                return (
                  <Circle 
                    key={z.id} 
                    center={[lat, lng]} 
                    radius={z.radius} 
                    pathOptions={{ 
                      color: z.category === 'High Danger' ? 'black' : z.category === 'Danger' ? 'red' : 'green',
                      fillColor: z.category === 'High Danger' ? 'black' : z.category === 'Danger' ? 'red' : 'green',
                      fillOpacity: 0.2
                    }} 
                  />
                );
              })}
            </MapContainer>
          </Card>
        </Col>
      </Row>

      <Row className="g-4">
        {/* Quadrant 1: Add Place */}
        <Col lg={6}>
          <Card className="shadow-sm border-0 rounded-4 p-4 h-100">
            <h5 className="fw-bold mb-3"><MapPin className="text-danger me-2"/> {editPlace ? "Update" : "Add"} Place</h5>
            <Form onSubmit={handlePlaceSubmit}>
              <Form.Control size="sm" className="mb-2" placeholder="Place Name" value={editPlace?.name || newPlace.name} onChange={e => editPlace ? setEditPlace({...editPlace, name: e.target.value}) : setNewPlace({...newPlace, name: e.target.value})} required />
              <Form.Control size="sm" className="mb-2" placeholder="City" value={editPlace?.city || newPlace.city} onChange={e => editPlace ? setEditPlace({...editPlace, city: e.target.value}) : setNewPlace({...newPlace, city: e.target.value})} />
              <Row className="g-2 mb-2">
                <Col>
                  <Form.Control 
                    size="sm" 
                    placeholder="Lat" 
                    value={editPlace?.lat ?? newPlace.lat} 
                    onChange={e => editPlace ? setEditPlace({...editPlace, lat: e.target.value}) : setNewPlace({...newPlace, lat: e.target.value})} 
                  />
                </Col>
                <Col>
                  <Form.Control 
                    size="sm" 
                    placeholder="Lng" 
                    value={editPlace?.lng ?? newPlace.lng} 
                    onChange={e => editPlace ? setEditPlace({...editPlace, lng: e.target.value}) : setNewPlace({...newPlace, lng: e.target.value})} 
                  />
                </Col>
              </Row>
              <Form.Control size="sm" className="mb-2" placeholder="Image URL" value={editPlace?.img || newPlace.img} onChange={e => editPlace ? setEditPlace({...editPlace, img: e.target.value}) : setNewPlace({...newPlace, img: e.target.value})} />
              <Form.Control as="textarea" size="sm" rows={3} className="mb-3" placeholder="Details..." value={editPlace?.details || newPlace.details} onChange={e => editPlace ? setEditPlace({...editPlace, details: e.target.value}) : setNewPlace({...newPlace, details: e.target.value})} />
              <Button type="submit" className="w-100 border-0 fw-bold py-2 rounded-pill" style={{ background: 'linear-gradient(90deg, #ff4b2b, #ff416c)' }}>
                Publish & Auto-Generate Safe Zones
              </Button>
            </Form>
          </Card>
        </Col>

        {/* Quadrant 2: Manage Destinations */}
        <Col lg={6}>
          <Card className="shadow-sm border-0 rounded-4 p-4 h-100">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="fw-bold m-0">Manage Destinations</h5>
              <InputGroup size="sm" style={{width: '180px'}}><InputGroup.Text><Search size={14}/></InputGroup.Text><Form.Control placeholder="Search..." onChange={e => setPlaceSearch(e.target.value)}/></InputGroup>
            </div>
            <div className="overflow-auto" style={{maxHeight: '320px'}}>
              <Table hover borderless size="sm">
                <thead><tr className="text-muted border-bottom"><th>Name</th><th>City</th><th className="text-center">Actions</th></tr></thead>
                <tbody>
                  {places.filter(p => p.name.toLowerCase().includes(placeSearch.toLowerCase())).map(p => (
                    <tr key={p.id}>
                      <td className="py-2 fw-semibold">{p.name}</td><td>{p.city}</td>
                      <td className="text-center">
                        <Button variant="link" size="sm" className="text-primary me-2" onClick={() => setEditPlace(p)}><Edit size={16}/></Button>
                        <Button variant="link" size="sm" className="text-danger" onClick={() => handleDelete('places', p.id)}><Trash2 size={16}/></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card>
        </Col>

        {/* Quadrant 3: Define Safe Zone */}
        <Col lg={6}>
          <Card className="shadow-sm border-0 rounded-4 p-4 h-100">
            <h5 className="fw-bold mb-3"><ShieldAlert className="text-danger me-2"/> Define Safe Zone</h5>
            <Form onSubmit={handleZoneSubmit}>
              <Form.Control size="sm" className="mb-2" placeholder="Zone Name" value={newZone.name} onChange={e => setNewZone({...newZone, name: e.target.value})} required />
              <Row className="g-2 mb-2">
                <Col>
                  <Form.Control 
                    size="sm" 
                    placeholder="Lat" 
                    value={newZone.lat} 
                    onChange={e => setNewZone({...newZone, lat: e.target.value})} 
                  />
                </Col>
                <Col>
                  <Form.Control 
                    size="sm" 
                    placeholder="Lng" 
                    value={newZone.lng} 
                    onChange={e => setNewZone({...newZone, lng: e.target.value})} 
                  />
                </Col>
              </Row>
              <Form.Control size="sm" className="mb-3" type="number" placeholder="Radius (meters)" value={newZone.radius} onChange={e => setNewZone({...newZone, radius: e.target.value})} required />
              <Button type="submit" className="w-100 border-0 fw-bold py-2 rounded-pill" style={{ background: 'linear-gradient(90deg, #ff4b2b, #ff416c)' }}>
                Create Geofence
              </Button>
            </Form>
          </Card>
        </Col>

        {/* Quadrant 4: Manage Geofences */}
        <Col lg={6}>
          <Card className="shadow-sm border-0 rounded-4 p-4 h-100">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="fw-bold m-0">Manage Geofences</h5>
              <InputGroup size="sm" style={{width: '180px'}}><InputGroup.Text><Search size={14}/></InputGroup.Text><Form.Control placeholder="Search..." onChange={e => setZoneSearch(e.target.value)}/></InputGroup>
            </div>
            <div className="overflow-auto" style={{maxHeight: '320px'}}>
              <Table hover borderless size="sm">
                <thead><tr className="text-muted border-bottom"><th>Name</th><th>Radius</th><th className="text-center">Actions</th></tr></thead>
                <tbody>
                  {safeZones.filter(z => z.name.toLowerCase().includes(zoneSearch.toLowerCase())).map(z => (
                    <tr key={z.id}>
                      <td className="py-2 fw-semibold">{z.name}</td><td>{z.radius}m</td>
                      <td className="text-center">
                        <Button variant="link" size="sm" className="text-danger" onClick={() => handleDelete('safe-zones', z.id)}><Trash2 size={16}/></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default Admin;