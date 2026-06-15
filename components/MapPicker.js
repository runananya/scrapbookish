"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER = [12.9716, 77.5946]; // Bangalore — sensible default

function tileUrl() {
  const k = process.env.NEXT_PUBLIC_STADIA_API_KEY;
  const base = "https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg";
  return k ? `${base}?api_key=${k}` : base;
}

const pinIcon = L.divIcon({
  className: "place-pin",
  html: '<div class="place-pin-inner place-pin-picker"><span>📍</span></div>',
  iconSize: [36, 44],
  iconAnchor: [18, 42],
});

export default function MapPicker({ value, onChange }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // debounced search via Nominatim
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&addressdetails=0&q=${encodeURIComponent(query)}`;
        const res = await fetch(url);
        const data = await res.json();
        setResults(data || []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [query]);

  function pickResult(r) {
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);
    onChange({ lat, lng, label: r.display_name });
    setResults([]);
    setQuery(r.display_name);
  }

  function pickFromClick(latlng) {
    onChange({ lat: latlng.lat, lng: latlng.lng, label: null });
  }

  const markerPos = value && value.lat && value.lng ? [value.lat, value.lng] : null;
  const initialCenter = markerPos || DEFAULT_CENTER;

  return (
    <div className="map-picker">
      <div className="map-picker-search">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="search a place (or click on map)"
          className="auth-input"
        />
        {(results.length > 0 || searching) && (
          <ul className="map-picker-results">
            {searching && <li className="map-picker-loading">searching…</li>}
            {results.map((r) => (
              <li key={`${r.osm_id}-${r.osm_type}`}>
                <button type="button" onClick={() => pickResult(r)}>
                  {r.display_name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="map-picker-wrap">
        <MapContainer
          center={initialCenter}
          zoom={markerPos ? 14 : 4}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://stamen.com/">Stamen</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url={tileUrl()}
          />
          {markerPos && <Marker position={markerPos} icon={pinIcon} />}
          <FlyTo position={markerPos} />
          <ClickHandler onPick={pickFromClick} />
        </MapContainer>
      </div>

      {markerPos && (
        <p className="map-picker-hint">
          📍 pinned at {markerPos[0].toFixed(4)}, {markerPos[1].toFixed(4)} — click elsewhere to move
        </p>
      )}
    </div>
  );
}

function FlyTo({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, 14, { duration: 0.6 });
  }, [position, map]);
  return null;
}

function ClickHandler({ onPick }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng);
    },
  });
  return null;
}
