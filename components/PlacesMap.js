"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const STATUS_CONFIG = {
  visited:     { cls: "place-pin-visited",     glyph: "✓" },
  wishlist:    { cls: "place-pin-wishlist",    glyph: "+" },
  recommended: { cls: "place-pin-recommended", glyph: "★" },
};

function makeIcon(status) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.visited;
  return L.divIcon({
    className: "place-pin",
    html: `<div class="place-pin-inner ${cfg.cls}"><span>${cfg.glyph}</span></div>`,
    iconSize: [36, 44],
    iconAnchor: [18, 42],
    popupAnchor: [0, -38],
  });
}

function tileUrl() {
  const k = process.env.NEXT_PUBLIC_STADIA_API_KEY;
  if (k) {
    return `https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg?api_key=${k}`;
  }
  // bulletproof fallback: plain OSM (no subdomain placeholders, no auth)
  return "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
}

function tileAttribution() {
  const k = process.env.NEXT_PUBLIC_STADIA_API_KEY;
  if (k) {
    return '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://stamen.com/">Stamen</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
  }
  return '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
}

// Force Leaflet to recompute its container size after the surrounding flex
// layout has settled. Without this, tiles can fail to load on first mount in
// production builds where the container has zero size at init.
function InvalidateSize() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 100);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

// Re-fit the map view to the bounds of the visible markers whenever the
// place list changes (used for search/filter).
function AutoFitToPlaces({ places, tempMarker }) {
  const map = useMap();
  const lastKeyRef = useRef("");
  useEffect(() => {
    // priority 1: a temp explore marker — fly to it
    if (tempMarker) {
      const key = `temp-${tempMarker.lat}-${tempMarker.lng}`;
      if (key !== lastKeyRef.current) {
        lastKeyRef.current = key;
        map.flyTo([tempMarker.lat, tempMarker.lng], 11, { duration: 0.9 });
      }
      return;
    }
    if (!places.length) return;
    const key = places.map((p) => p.id).join(",");
    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;
    if (places.length === 1) {
      map.flyTo([places[0].lat, places[0].lng], 13, { duration: 0.8 });
    } else {
      const bounds = L.latLngBounds(places.map((p) => [p.lat, p.lng]));
      map.flyToBounds(bounds, { padding: [60, 60], maxZoom: 14, duration: 0.8 });
    }
  }, [places, map, tempMarker]);
  return null;
}

const tempPinIcon = L.divIcon({
  className: "place-pin",
  html: '<div class="place-pin-inner place-pin-temp"><span>?</span></div>',
  iconSize: [36, 44],
  iconAnchor: [18, 42],
  popupAnchor: [0, -38],
});

export default function PlacesMap({ places, autoFit = false, tempMarker = null }) {
  const center = places.length
    ? [places[0].lat, places[0].lng]
    : [12.9716, 77.5946];
  const zoom = places.length === 1 ? 12 : (places.length > 1 ? 4 : 4);

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom
    >
      <TileLayer
        attribution={tileAttribution()}
        url={tileUrl()}
      />
      <InvalidateSize />
      {places.map((p) => (
        <Marker key={p.id} position={[p.lat, p.lng]} icon={makeIcon(p.status)}>
          <Popup>
            <div className="map-popup">
              {p.photo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.photo_url} alt={p.name} className="map-popup-photo" />
              )}
              <h4 className="map-popup-name">{p.name}</h4>
              {p.location && <p className="map-popup-location">📍 {p.location}</p>}
              {p.rating > 0 && (
                <p className="map-popup-stars">
                  {"★".repeat(p.rating)}
                  <span style={{ color: "rgba(0,0,0,0.2)" }}>{"★".repeat(5 - p.rating)}</span>
                </p>
              )}
              {p.review && <p className="map-popup-review">{p.review}</p>}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
