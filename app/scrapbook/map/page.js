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

export default function ScrapbookMapPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [places, setPlaces] = useState([]);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      const { data } = await supabase
        .from("places")
        .select("*")
        .eq("user_id", user.id)
        .not("lat", "is", null)
        .not("lng", "is", null);
      setPlaces(data || []);
      setLoading(false);
    })();
  }, [router]);

  const filtered = useMemo(
    () => filter === "all" ? places : places.filter((p) => p.status === filter),
    [filter, places]
  );

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
          {filtered.length} {filtered.length === 1 ? "place" : "places"}
        </span>
      </div>

      <div className="map-stage">
        <PlacesMap places={filtered} />
        {filtered.length === 0 && (
          <div className="map-empty-overlay">
            <div className="empty-state map-empty">
              <p className="empty-emoji">🗺️</p>
              <p className="empty-title">no pins yet</p>
              <p className="empty-sub">
                {places.length === 0
                  ? "add a place and pin it on the map — it'll show up here"
                  : "no places match this filter — try another"}
              </p>
              <Link href="/scrapbook/add" className="btn btn-primary">+ add a place</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function filterStickerCls(id) {
  if (id === "all")         return "sticker-yellow";
  if (id === "visited")     return "sticker-sage";
  if (id === "wishlist")    return "sticker-pink";
  if (id === "recommended") return "sticker-coral";
  return "sticker-pink";
}
