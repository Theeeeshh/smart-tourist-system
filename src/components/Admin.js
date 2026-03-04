import React, { useState, useEffect, useRef } from 'react';
import { Container, Row, Col, Table, Form, Button, InputGroup, Spinner, Card } from 'react-bootstrap';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents, useMap } from 'react-leaflet';
import { MapPin, ShieldAlert, Trash2, Edit, Search } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({ iconUrl: markerIcon, shadowUrl: markerShadow, iconSize: [25, 41], iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

function MapPanTo({ position }) {
  const map = useMap();
  useEffect(() => {
    if (!position || isNaN(position[0]) || isNaN(position[1])) return;
    const timeoutId = setTimeout(() => { map.panTo(position, { animate: true, duration: 0.8 }); }, 500);
    return () => clearTimeout(timeoutId);
  }, [position, map]);
  return null;
}

function MapClickHandler({ onMapClick }) {
  useMapEvents({ click: (e) => onMapClick(e.latlng.lat, e.latlng.lng) });
  return null;
}

const Admin = () => {
  const [tourists, setTourists] = useState([]);
  const [safeZones, setSafeZones] = useState([]);
  const [places, setPlaces] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  
  const [placeSearch, setPlaceSearch] = useState("");
  const [zoneSearch, setZoneSearch] = useState("");

  const defaultPlace = { name: '', city: '', img: '', details: '', lat: '', lng: '', type: 'Tourist Attraction', rating: 4.5, fee: 0, active_from: null, active_to: null };
  const [newPlace, setNewPlace] = useState(defaultPlace);
  const [editPlace, setEditPlace] = useState(null);

  const defaultZone = { name: '', lat: '', lng: '', radius: 500, category: 'Safe' };
  const [newZone, setNewZone] = useState(defaultZone);
  const [editZone, setEditZone] = useState(null);

  const autoCompleteRef = useRef(null);

  useEffect(() => {
    if (!window.google) return; 

    const autocomplete = new window.google.maps.places.Autocomplete(autoCompleteRef.current, {
      fields: ["name", "geometry", "types", "rating", "address_components", "opening_hours"],
    });

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (!place.geometry) return;

      const cityObj = place.address_components?.find(c => c.types.includes("locality") || c.types.includes("administrative_area_level_2"));
      const city = cityObj ? cityObj.long_name : "";

      let pType = "Tourist Attraction";
      const validTypes = place.types?.filter(t => !['point_of_interest', 'establishment'].includes(t)) || [];
      if (validTypes.length > 0) pType = validTypes[0].replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

      // Extract real timings
      let openTime = null;
      let closeTime = null;
      if (place.opening_hours && place.opening_hours.periods) {
        const today = new Date().getDay();
        const todayPeriod = place.opening_hours.periods.find(p => p.open && p.open.day === today);
        if (todayPeriod) {
          if (todayPeriod.open) openTime = `${todayPeriod.open.time.substring(0,2)}:${todayPeriod.open.time.substring(2,4)}:00`;
          if (todayPeriod.close) closeTime = `${todayPeriod.close.time.substring(0,2)}:${todayPeriod.close.time.substring(2,4)}:00`;
        }
      }

      setNewPlace(prev => ({
        ...prev,
        name: place.name, city: city,
        lat: place.geometry.location.lat().toFixed(6), lng: place.geometry.location.lng().toFixed(6),
        type: pType, rating: place.rating || 4.5, active_from: openTime, active_to: closeTime
      }));
    });
  }, []);

  const fetchData = async () => {
    try {
      const [tRes, zRes, pRes] = await Promise.all([ fetch('/api/admin/tourists'), fetch('/api/admin/safe-zones'), fetch('/api/places') ]);
      if (tRes.ok && zRes.ok && pRes.ok) {
        setTourists(await tRes.json()); setSafeZones(await zRes.json()); setPlaces(await pRes.json());
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
    const fLat = lat.toFixed(6); const fLng = lng.toFixed(6);
    if (editPlace) setEditPlace({ ...editPlace, lat: fLat, lng: fLng });
    else if (editZone) setEditZone({ ...editZone, lat: fLat, lng: fLng });
    else if (newZone.name !== '') setNewZone({ ...newZone, lat: fLat, lng: fLng });
    else setNewPlace({ ...newPlace, lat: fLat, lng: fLng });
  };

  const handlePlaceSubmit = async (e) => {
    e.preventDefault();
    const method = editPlace ? 'PUT' : 'POST';
    const url = editPlace ? `/api/admin/places/${editPlace.id}` : '/api/admin/places';
    
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editPlace || newPlace) });
    setEditPlace(null); setNewPlace(defaultPlace);
    
    if (!editPlace) alert("Place saved! RakshaSetu AI is generating safety zones in the background. They will appear on the map shortly.");
    fetchData();
  };

  const handleZoneSubmit = async (e) => {
    e.preventDefault();
    await fetch('/api/admin/safe-zones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...newZone, lat: parseFloat(newZone.lat), lng: parseFloat(newZone.lng) }) });
    setNewZone(defaultZone); fetchData();
  };

  const handleDelete = async (type, id) => {
    if (window.confirm(`Permanently delete this ${type}?`)) {
      await fetch(`/api/admin/${type}/${id}`, { method: 'DELETE' });
      fetchData();
    }
  };

  let draftLat = NaN, draftLng = NaN; let draftRadius = 150; let isZoneActive = false;
  if (editPlace && editPlace.lat !== '') { draftLat = parseFloat(editPlace.lat); draftLng = parseFloat(editPlace.lng); }
  else if (editZone && editZone.lat !== '') { draftLat = parseFloat(editZone.lat); draftLng = parseFloat(editZone.lng); draftRadius = parseFloat(editZone.radius); isZoneActive = true; }
  else if (newZone.lat !== '') { draftLat = parseFloat(newZone.lat); draftLng = parseFloat(newZone.lng); draftRadius = parseFloat(newZone.radius); isZoneActive = true; }
  else if (newPlace.lat !== '') { draftLat = parseFloat(newPlace.lat); draftLng = parseFloat(newPlace.lng); }
  if (isNaN(draftRadius) || draftRadius <= 0) draftRadius = 10;
  const previewPosition = (!isNaN(draftLat) && !isNaN(draftLng)) ? [draftLat, draftLng] : null;

  if (initialLoading) return ( <Container className="d-flex justify-content-center align-items-center" style={{height: '100vh'}}><Spinner animation="grow" variant="danger" /></Container> );

  return (
    <Container fluid className="py-4 px-5" style={{ background: 'linear-gradient(135deg, #fff5f5 0%, #f0f4ff 100%)', minHeight: '100vh' }}>
      <Row className="mb-4">
        <Col>
          <Card className="shadow-sm border-0 rounded-4 overflow-hidden" style={{ height: '400px' }}>
            <MapContainer center={[20.5937, 78.9629]} zoom={5} style={{ height: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MapClickHandler onMapClick={handleMapClick} />
              <MapPanTo position={previewPosition} />
              
              {previewPosition && (
                <>
                  <Marker position={previewPosition} opacity={0.8}><Popup>📍 <strong>Draft Location</strong><br/>{isZoneActive ? `Radius: ${draftRadius}m` : 'Updates as you type!'}</Popup></Marker>
                  <Circle center={previewPosition} radius={draftRadius} pathOptions={{ color: '#0d6efd', fillOpacity: 0.1, dashArray: '5, 10' }} />
                </>
              )}
              
              {tourists.map(t => !isNaN(parseFloat(t.last_lat)) && (
                <Marker key={t.id} position={[parseFloat(t.last_lat), parseFloat(t.last_lng)]}><Popup><strong>{t.username}</strong><br/>{t.is_online ? "🟢 Online" : "⚪ Offline"}</Popup></Marker>
              ))}
              {safeZones.map(z => !isNaN(parseFloat(z.lat)) && (
                <Circle key={z.id} center={[parseFloat(z.lat), parseFloat(z.lng)]} radius={z.radius} 
                  pathOptions={{ color: z.category === 'High Danger' ? 'black' : z.category === 'Danger' ? 'red' : 'green', fillColor: z.category === 'High Danger' ? 'black' : z.category === 'Danger' ? 'red' : 'green', fillOpacity: 0.2 }} 
                />
              ))}
            </MapContainer>
          </Card>
        </Col>
      </Row>

      <Row className="g-4">
        <Col lg={6}>
          <Card className="shadow-sm border-0 rounded-4 p-4 h-100">
            <h5 className="fw-bold mb-3"><MapPin className="text-danger me-2"/> {editPlace ? "Update" : "Add"} Place</h5>
            <Form onSubmit={handlePlaceSubmit}>
              <Form.Control 
                ref={autoCompleteRef} 
                size="sm" className="mb-2" placeholder="Search Google Places..." 
                value={editPlace?.name || newPlace.name} 
                onChange={e => editPlace ? setEditPlace({...editPlace, name: e.target.value}) : setNewPlace({...newPlace, name: e.target.value})} 
                required 
              />
              <Form.Control size="sm" className="mb-2" placeholder="City" value={editPlace?.city || newPlace.city} onChange={e => editPlace ? setEditPlace({...editPlace, city: e.target.value}) : setNewPlace({...newPlace, city: e.target.value})} />
              <Row className="g-2 mb-2">
                <Col><Form.Control size="sm" placeholder="Lat" value={editPlace?.lat ?? newPlace.lat} onChange={e => editPlace ? setEditPlace({...editPlace, lat: e.target.value}) : setNewPlace({...newPlace, lat: e.target.value})} /></Col>
                <Col><Form.Control size="sm" placeholder="Lng" value={editPlace?.lng ?? newPlace.lng} onChange={e => editPlace ? setEditPlace({...editPlace, lng: e.target.value}) : setNewPlace({...newPlace, lng: e.target.value})} /></Col>
              </Row>
              <Form.Control size="sm" className="mb-2" placeholder="Image URL" value={editPlace?.img || newPlace.img} onChange={e => editPlace ? setEditPlace({...editPlace, img: e.target.value}) : setNewPlace({...newPlace, img: e.target.value})} />
              <Form.Control as="textarea" size="sm" rows={3} className="mb-3" placeholder="Details..." value={editPlace?.details || newPlace.details} onChange={e => editPlace ? setEditPlace({...editPlace, details: e.target.value}) : setNewPlace({...newPlace, details: e.target.value})} />
              <Button type="submit" className="w-100 border-0 fw-bold py-2 rounded-pill" style={{ background: 'linear-gradient(90deg, #ff4b2b, #ff416c)' }}>Publish & Auto-Generate Safe Zones</Button>
            </Form>
          </Card>
        </Col>

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

        <Col lg={6}>
          <Card className="shadow-sm border-0 rounded-4 p-4 h-100">
            <h5 className="fw-bold mb-3"><ShieldAlert className="text-danger me-2"/> Define Safe Zone</h5>
            <Form onSubmit={handleZoneSubmit}>
              <Form.Control size="sm" className="mb-2" placeholder="Zone Name" value={newZone.name} onChange={e => setNewZone({...newZone, name: e.target.value})} required />
              <Row className="g-2 mb-2">
                <Col><Form.Control size="sm" placeholder="Lat" value={newZone.lat} onChange={e => setNewZone({...newZone, lat: e.target.value})} /></Col>
                <Col><Form.Control size="sm" placeholder="Lng" value={newZone.lng} onChange={e => setNewZone({...newZone, lng: e.target.value})} /></Col>
              </Row>
              <Form.Control size="sm" className="mb-3" type="number" placeholder="Radius (meters)" value={newZone.radius} onChange={e => setNewZone({...newZone, radius: e.target.value})} required />
              <Button type="submit" className="w-100 border-0 fw-bold py-2 rounded-pill" style={{ background: 'linear-gradient(90deg, #ff4b2b, #ff416c)' }}>Create Geofence</Button>
            </Form>
          </Card>
        </Col>

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
                      <td className="text-center"><Button variant="link" size="sm" className="text-danger" onClick={() => handleDelete('safe-zones', z.id)}><Trash2 size={16}/></Button></td>
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