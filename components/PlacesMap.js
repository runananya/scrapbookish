"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
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
    // pretty watercolor (Stadia free tier — needs key for non-localhost domains)
    return `https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg?api_key=${k}`;
  }
  // free fallback: CartoDB Voyager — clean artistic light theme, no auth needed
  return "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
}

function tileAttribution() {
  const k = process.env.NEXT_PUBLIC_STADIA_API_KEY;
  if (k) {
    return '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://stamen.com/">Stamen</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
  }
  return '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
}

export default function PlacesMap({ places }) {
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
