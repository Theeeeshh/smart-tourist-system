import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Container, Row, Col, Table, Form, Button, Badge, InputGroup, Spinner } from 'react-bootstrap';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents, useMap } from 'react-leaflet';
import { Users, MapPin, ShieldAlert, Search, Target } from 'lucide-react';
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

// Helper: Handles Smooth Zooming to Zones/Places
function MapPanTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target && target.lat && target.lng) {
      map.flyTo([target.lat, target.lng], 14, { duration: 1.5 });
    }
  }, [target, map]);
  return null;
}

// Helper: Captures clicks on the map for coordinate selection
function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

const Admin = () => {
  const [tourists, setTourists] = useState([]);
  const [safeZones, setSafeZones] = useState([]);
  const [places, setPlaces] = useState([]);
  
  // State for initial full-page loader
  const [initialLoading, setInitialLoading] = useState(true);
  // State for showing a small indicator during background refreshes (optional)
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [mapTarget, setMapTarget] = useState(null);
  const [zoneSearch, setZoneSearch] = useState("");
  const [placeSearch, setPlaceSearch] = useState("");

  const [newPlace, setNewPlace] = useState({ 
    name: '', city: '', img: '', details: '', lat: '', lng: '', type: 'Temple', rating: 4.5, fee: 0 
  });
  const [editPlace, setEditPlace] = useState(null);
  const [newZone, setNewZone] = useState({ name: '', lat: '', lng: '', radius: '', category: 'Safe' });
  const [editZone, setEditZone] = useState(null);

  // Use a Ref to track if it's the first fetch
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
        const tData = await tRes.json();
        const zData = await zRes.json();
        const pData = await pRes.json();
        
        setTourists(Array.isArray(tData) ? tData : []);
        setSafeZones(Array.isArray(zData) ? zData : []);
        setPlaces(Array.isArray(pData) ? pData : []);
      }
    } catch (err) { 
      if (err.name !== 'AbortError') console.error("Fetch error:", err); 
    } finally {
      setInitialLoading(false);
      setIsRefreshing(false);
      isFirstRun.current = false;
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    
    // Auto-refresh every 10 seconds WITHOUT triggering the full-page spinner
    const interval = setInterval(() => fetchData(controller.signal), 10000);
    
    return () => { 
      controller.abort(); 
      clearInterval(interval); 
    };
  }, []);

  const handleMapClick = (lat, lng) => {
    const formattedLat = lat.toFixed(6);
    const formattedLng = lng.toFixed(6);
    if (editZone) setEditZone({ ...editZone, lat: formattedLat, lng: formattedLng });
    else if (editPlace) setEditPlace({ ...editPlace, lat: formattedLat, lng: formattedLng });
    else if (newZone.name !== '') setNewZone({ ...newZone, lat: formattedLat, lng: formattedLng });
    else setNewPlace({ ...newPlace, lat: formattedLat, lng: formattedLng });
  };

  // Memoized filters to prevent unnecessary re-calculations
  const filteredZones = useMemo(() => 
    (safeZones || []).filter(z => z.name?.toLowerCase().includes(zoneSearch.toLowerCase())),
    [safeZones, zoneSearch]
  );

  const filteredPlaces = useMemo(() => 
    (places || []).filter(p => p.name?.toLowerCase().includes(placeSearch.toLowerCase())),
    [places, placeSearch]
  );

  const stats = useMemo(() => ({
    danger: (tourists || []).filter(t => t.is_online && t.current_status?.toLowerCase().includes("danger")).length,
    normal: (tourists || []).filter(t => t.is_online && !t.current_status?.toLowerCase().includes("danger")).length
  }), [tourists]);

  // FULL PAGE SPINNER: Only runs once on startup
  if (initialLoading) {
    return (
      <Container className="d-flex justify-content-center align-items-center" style={{height: '80vh'}}>
        <div className="text-center">
          <Spinner animation="grow" variant="primary" />
          <p className="mt-3 fw-bold text-primary">RakshaSetu: Secure Link Established...</p>
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-5">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="fw-bold text-dark m-0">RakshaSetu Command Center</h2>
          {isRefreshing && <small className="text-muted italic">Updating live feed...</small>}
        </div>
        <div className="d-flex gap-3">
            <Badge bg="danger" className="p-2 px-3 shadow-sm fs-6">In Danger: {stats.danger}</Badge>
            <Badge bg="success" className="p-2 px-3 shadow-sm fs-6">Normal: {stats.normal}</Badge>
        </div>
      </div>
      
      <Row className="g-4 mb-5">
        <Col lg={8}>
          <div className="bg-white shadow-sm p-0 overflow-hidden" style={{ height: '450px', position: 'relative', borderRadius: '15px', border: '1px solid #ddd' }}>
            <MapContainer center={[20.5937, 78.9629]} zoom={5} style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MapPanTo target={mapTarget} />
              <MapClickHandler onMapClick={handleMapClick} />
              
              {tourists?.map(t => t.last_lat && (
                <Marker key={t.id} position={[t.last_lat, t.last_lng]}>
                  <Popup>
                    <strong>{t.username}</strong><br/>
                    Status: <span className={t.current_status?.includes("Danger") ? "text-danger" : "text-success"}>
                      {t.current_status || "Safe"}
                    </span>
                  </Popup>
                </Marker>
              ))}

              {safeZones?.map(zone => (
                <Circle 
                  key={zone.id} center={[zone.lat, zone.lng]} radius={zone.radius} 
                  pathOptions={{ 
                    color: zone.category === "High Danger" ? '#000' : zone.category === "Danger" ? '#ff0000' : zone.category === "Safe" ? '#ffcc00' : '#28a745',
                    fillColor: zone.category === "High Danger" ? '#000' : zone.category === "Danger" ? '#ff0000' : zone.category === "Safe" ? '#ffcc00' : '#28a745',
                    fillOpacity: 0.3 
                  }} 
                />
              ))}
            </MapContainer>
          </div>
        </Col>

        <Col lg={4}>
          <div className="bg-white h-100 shadow-sm p-3 border" style={{ borderRadius: '15px' }}>
            <h5 className="fw-bold mb-3"><Users size={20} className="me-2 text-primary"/>Active Tourists</h5>
            <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
              <Table hover size="sm">
                <thead className="table-light"><tr><th>User</th><th>Track</th></tr></thead>
                <tbody>
                  {tourists.length > 0 ? tourists.map(t => (
                    <tr key={t.id}>
                      <td className="align-middle">
                        <div className="d-flex align-items-center">
                           <div className={`me-2 rounded-circle ${t.is_online ? 'bg-success' : 'bg-secondary'}`} style={{width: '8px', height: '8px'}}></div>
                           {t.username}
                        </div>
                      </td>
                      <td>
                        <Button variant="outline-primary" size="sm" onClick={() => setMapTarget({lat: t.last_lat, lng: t.last_lng})}>
                          <Target size={14}/>
                        </Button>
                      </td>
                    </tr>
                  )) : <tr><td colSpan="2" className="text-center text-muted">No tourists active</td></tr>}
                </tbody>
              </Table>
            </div>
          </div>
        </Col>
      </Row>

      {/* Destination Management */}
      <div className="bg-white shadow-sm p-4 mb-5 border" style={{ borderRadius: '15px' }}>
        <div className="d-flex justify-content-between mb-3 align-items-center">
            <h5 className="fw-bold m-0"><MapPin size={20} className="me-2 text-info"/>Destinations</h5>
            <InputGroup style={{ width: '300px' }}>
                <InputGroup.Text className="bg-white"><Search size={16}/></InputGroup.Text>
                <Form.Control placeholder="Filter destinations..." value={placeSearch} onChange={e => setPlaceSearch(e.target.value)} />
            </InputGroup>
        </div>
        <Table responsive hover size="sm">
          <thead className="table-light"><tr><th>Name</th><th>City</th><th>Live Nearby</th><th>Actions</th></tr></thead>
          <tbody>
            {filteredPlaces.map(p => (
              <tr key={p.id}>
                <td>{p.name}</td><td>{p.city}</td>
                <td>
                  <Badge bg="info">
                    {(tourists || []).filter(t => t.last_lat && L.latLng(p.lat, p.lng).distanceTo([t.last_lat, t.last_lng]) < 5000).length} Near
                  </Badge>
                </td>
                <td>
                  <Button variant="link" size="sm" onClick={() => setMapTarget({lat: p.lat, lng: p.lng})}>
                    <Target size={18}/>
                  </Target>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      {/* Geofence Management */}
      <div className="bg-white shadow-sm p-4 border" style={{ borderRadius: '15px' }}>
        <div className="d-flex justify-content-between mb-3 align-items-center">
            <h5 className="fw-bold m-0"><ShieldAlert size={20} className="me-2 text-danger"/>Geofences (Safety Zones)</h5>
            <InputGroup style={{ width: '300px' }}>
                <InputGroup.Text className="bg-white"><Search size={16}/></InputGroup.Text>
                <Form.Control placeholder="Filter zones..." value={zoneSearch} onChange={e => setZoneSearch(e.target.value)} />
            </InputGroup>
        </div>
        <Table responsive hover size="sm">
          <thead className="table-light"><tr><th>Zone Name</th><th>Category</th><th>Inside</th><th>Actions</th></tr></thead>
          <tbody>
            {filteredZones.map(z => (
              <tr key={z.id}>
                <td>{z.name}</td>
                <td>
                  <Badge bg={z.category === "High Danger" ? "dark" : z.category === "Danger" ? "danger" : z.category === "Safe" ? "warning" : "success"}>
                    {z.category}
                  </Badge>
                </td>
                <td>
                  <Badge bg="secondary" pill>
                    {(tourists || []).filter(t => t.last_lat && L.latLng(z.lat, z.lng).distanceTo([t.last_lat, t.last_lng]) <= z.radius).length}
                  </Badge>
                </td>
                <td>
                  <Button variant="outline-secondary" size="sm" onClick={() => setMapTarget({lat: z.lat, lng: z.lng})}>
                    <Search size={14}/>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </Container>
  );
};

export default Admin;