"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const PlacesMap = dynamic(() => import("@/components/PlacesMap"), { ssr: false });

const FILTERS = [
  { id: "all",         label: "all" },
  { id: "visited",     label: "been there ✓" },
  { id: "wishlist",    label: "want to go +" },
  { id: "recommended", label: "recommend ★" },
];

function filterStickerCls(id) {
  if (id === "all")         return "sticker-yellow";
  if (id === "visited")     return "sticker-sage";
  if (id === "wishlist")    return "sticker-pink";
  if (id === "recommended") return "sticker-coral";
  return "sticker-pink";
}

function filterEmptyTitle(id) {
  if (id === "visited")     return "no 'been there' pins yet";
  if (id === "wishlist")    return "no 'want to go' pins yet";
  if (id === "recommended") return "no 'recommend' pins yet";
  return "no pins yet";
}

export default function ScrapbookMapPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [places, setPlaces] = useState([]);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [nominatim, setNominatim] = useState([]);
  const [nominatimLoading, setNominatimLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [tempMarker, setTempMarker] = useState(null); // { lat, lng, name }
  const [addingIdx, setAddingIdx] = useState(null); // which nominatim result is currently adding
  const [toast, setToast] = useState("");

  useEffect(() => { loadData(); }, []); // eslint-disable-line

  async function loadData() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    setUser(user);
    const { data } = await supabase
      .from("places")
      .select("*")
      .eq("user_id", user.id)
      .not("lat", "is", null)
      .not("lng", "is", null);
    setPlaces(data || []);
    setLoading(false);
  }

  async function quickAddNominatim(r, status, idx) {
    if (!user || addingIdx !== null) return;
    setAddingIdx(idx);
    const supabase = createClient();
    const shortName = r.display_name.split(",")[0];
    const { error } = await supabase.from("places").insert({
      user_id: user.id,
      name: shortName,
      location: r.display_name,
      status,
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
    });
    setAddingIdx(null);
    if (error) {
      alert(error.message);
      return;
    }
    // refresh places list + remove from search + brief confirmation
    await loadData();
    setNominatim((prev) => prev.filter((x) => x !== r));
    setTempMarker(null);
    const labels = { visited: "been there ✓", wishlist: "want to go +", recommended: "recommended ★" };
    setToast(`✨ saved ${shortName} as ${labels[status]}`);
    setTimeout(() => setToast(""), 2600);
  }

  // Debounced Nominatim geocoding for arbitrary locations
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setNominatim([]);
      setNominatimLoading(false);
      return;
    }
    setNominatimLoading(true);
    const timer = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&addressdetails=0&q=${encodeURIComponent(q)}`;
        const res = await fetch(url);
        const data = await res.json();
        setNominatim(data || []);
      } catch {
        setNominatim([]);
      } finally {
        setNominatimLoading(false);
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [query]);

  const filtered = useMemo(() => {
    let result = places;
    if (filter !== "all") result = result.filter((p) => p.status === filter);
    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter((p) => {
        const hay = `${p.name || ""} ${p.location || ""} ${p.review || ""}`.toLowerCase();
        return hay.includes(q);
      });
    }
    return result;
  }, [filter, query, places]);

  if (loading) {
    return <main className="auth-wrap"><p className="auth-sub">loading the map…</p></main>;
  }

  return (
    <div className="map-page">
      <header className="nav nav-map">
        <Link href="/" className="logo">scrapbook<span className="logo-dot">.</span></Link>
        <nav className="nav-links">
          <Link href="/scrapbook" className="sticker sticker-pink">grid view</Link>
          <Link href="/scrapbook/add" className="sticker sticker-sage">+ add a place</Link>
        </nav>
      </header>

      <div className="map-filters-stack">
        <div className="map-search-wrap">
          <input
            type="search"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setDropdownOpen(true); }}
            onFocus={() => setDropdownOpen(true)}
            onBlur={() => setTimeout(() => setDropdownOpen(false), 200)}
            placeholder="🔍 search your places or anywhere on the map…"
            className="map-search"
          />
          {dropdownOpen && query.trim().length >= 2 && (
            <div className="map-search-dropdown">
              {filtered.length > 0 && (
                <>
                  <p className="map-search-section">your places ({filtered.length})</p>
                  <ul>
                    {filtered.slice(0, 5).map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setTempMarker(null);
                            setQuery(p.name);
                            setDropdownOpen(false);
                          }}
                          className="map-search-result"
                        >
                          📌 <strong>{p.name}</strong>
                          {p.location && <span> — {p.location}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <p className="map-search-section">other locations {nominatimLoading && "· searching…"}</p>
              {nominatim.length === 0 && !nominatimLoading ? (
                <p className="map-search-empty">type a city or place to search anywhere</p>
              ) : (
                <ul>
                  {nominatim.map((r, idx) => {
                    const shortName = r.display_name.split(",")[0];
                    const rest = r.display_name.split(",").slice(1).join(",").trim();
                    const isAdding = addingIdx === idx;
                    return (
                      <li key={`${r.osm_id}-${r.osm_type}`} className="map-search-result-wrap">
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setTempMarker({
                              lat: parseFloat(r.lat),
                              lng: parseFloat(r.lon),
                              name: r.display_name,
                            });
                          }}
                          className="map-search-result"
                        >
                          <strong>🌍 {shortName}</strong>
                          {rest && <span>{rest}</span>}
                        </button>
                        <div className="quick-add-row">
                          <button
                            type="button"
                            disabled={isAdding}
                            onMouseDown={(e) => { e.preventDefault(); quickAddNominatim(r, "visited", idx); }}
                            className="quick-add-btn quick-add-visited"
                          >
                            ✓ been there
                          </button>
                          <button
                            type="button"
                            disabled={isAdding}
                            onMouseDown={(e) => { e.preventDefault(); quickAddNominatim(r, "wishlist", idx); }}
                            className="quick-add-btn quick-add-wishlist"
                          >
                            + want to go
                          </button>
                          <button
                            type="button"
                            disabled={isAdding}
                            onMouseDown={(e) => { e.preventDefault(); quickAddNominatim(r, "recommended", idx); }}
                            className="quick-add-btn quick-add-recommended"
                          >
                            ★ recommend
                          </button>
                          <a
                            href={`/scrapbook/add?lat=${r.lat}&lng=${r.lon}&name=${encodeURIComponent(shortName)}&location=${encodeURIComponent(r.display_name)}`}
                            className="quick-add-more"
                            onMouseDown={(e) => e.preventDefault()}
                          >
                            more details →
                          </a>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
        <div className="map-filters">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`sticker ${filterStickerCls(f.id)} ${filter === f.id ? "sticker-active" : ""}`}
            >
              {f.label}
            </button>
          ))}
          <span className="map-count">
            {filtered.length === places.length
              ? `${filtered.length} ${filtered.length === 1 ? "place" : "places"}`
              : `${filtered.length} of ${places.length}`}
          </span>
          {(query || filter !== "all" || tempMarker) && (
            <button
              type="button"
              onClick={() => { setQuery(""); setFilter("all"); setTempMarker(null); }}
              className="map-clear-btn"
            >
              clear
            </button>
          )}
        </div>
      </div>

      {toast && <div className="map-toast">{toast}</div>}

      <div className="map-stage">
        <PlacesMap places={filtered} />
        {filtered.length === 0 && (
          <div className="map-empty-overlay">
            <div className="empty-state map-empty">
              <p className="empty-emoji">🗺️</p>
              <p className="empty-title">
                {places.length === 0
                  ? "no pins yet"
                  : filter === "all"
                  ? "no places match your search"
                  : filterEmptyTitle(filter)}
              </p>
              <p className="empty-sub">
                {places.length === 0
                  ? "search a place above ↑ and tap a status to drop your first pin"
                  : "type a place in the search above ↑ — the quick-add buttons let you save it as this status in one tap"}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
