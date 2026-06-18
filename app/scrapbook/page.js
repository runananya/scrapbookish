"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

const MemoriesBook = dynamic(() => import("@/components/MemoriesBook"), { ssr: false });
const FriendsFeed = dynamic(() => import("@/components/FriendsFeed"), { ssr: false });
import UserMenu from "@/components/UserMenu";
import MobileNav from "@/components/MobileNav";
import LazyOnVisible from "@/components/LazyOnVisible";

export default function ScrapbookPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [places, setPlaces] = useState([]);
  const [recs, setRecs] = useState([]); // pending recs with joined place + sender name
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");

  useEffect(() => { load(); }, []); // eslint-disable-line

  async function load() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    setUser(user);

    const [{ data: placesData }, { data: recsData }, { data: profileData }] = await Promise.all([
      supabase.from("places").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase
        .from("recommendations")
        .select("*")
        .eq("to_user_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    ]);

    setProfile(profileData);
    setPlaces(placesData || []);

    // hydrate recs with their place + sender name
    if (recsData && recsData.length > 0) {
      const placeIds = recsData.map((r) => r.place_id);
      const senderIds = Array.from(new Set(recsData.map((r) => r.from_user_id)));
      const [{ data: rPlaces }, { data: rSenders }] = await Promise.all([
        supabase.from("places").select("*").in("id", placeIds),
        supabase.from("profiles").select("id, display_name").in("id", senderIds),
      ]);
      const placeMap = Object.fromEntries((rPlaces || []).map((p) => [p.id, p]));
      const senderMap = Object.fromEntries((rSenders || []).map((s) => [s.id, s.display_name || "friend"]));
      setRecs(
        recsData
          .map((r) => ({ ...r, place: placeMap[r.place_id], senderName: senderMap[r.from_user_id] || "friend" }))
          .filter((r) => r.place)
      );
    } else {
      setRecs([]);
    }

    setLoading(false);
  }

  async function addRecToWishlist(rec) {
    const supabase = createClient();
    const src = rec.place;
    const { error: insErr } = await supabase.from("places").insert({
      user_id: user.id,
      name: src.name,
      location: src.location,
      photo_url: src.photo_url,
      photos: src.photos,
      rating: null,
      review: rec.note ? `recommended by ${rec.senderName}: ${rec.note}` : `recommended by ${rec.senderName}`,
      status: "wishlist",
      lat: src.lat,
      lng: src.lng,
    });
    if (insErr) { alert(insErr.message); return; }
    await supabase.from("recommendations").update({ status: "added" }).eq("id", rec.id);
    setRecs((prev) => prev.filter((r) => r.id !== rec.id));
    load();
  }

  async function dismissRec(rec) {
    const supabase = createClient();
    await supabase.from("recommendations").update({ status: "dismissed" }).eq("id", rec.id);
    setRecs((prev) => prev.filter((r) => r.id !== rec.id));
  }

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  async function deletePlace(place) {
    if (!confirm(`remove "${place.name}" from your scrapbook?`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("places").delete().eq("id", place.id);
    if (error) {
      alert(error.message);
      return;
    }
    setPlaces((prev) => prev.filter((p) => p.id !== place.id));
  }

  if (loading) {
    return <main className="auth-wrap"><p className="auth-sub">loading your scrapbook…</p></main>;
  }

  const name = profile?.display_name || user.user_metadata?.display_name || user.email?.split("@")[0] || "friend";

  // Filter places by search + status
  const q = query.trim().toLowerCase();
  const filteredPlaces = places.filter((p) => {
    if (filter !== "all" && p.status !== filter) return false;
    if (q) {
      const haystack = `${p.name || ""} ${p.location || ""} ${p.review || ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const stats = {
    total: places.length,
    visited: places.filter((p) => p.status === "visited").length,
    wishlist: places.filter((p) => p.status === "wishlist").length,
    recommended: places.filter((p) => p.status === "recommended").length,
  };

  return (
    <>
      <span className="tape tape-1" />
      <span className="tape tape-2" />
      <span className="doodle-star doodle-star-1">★</span>
      <span className="doodle-star doodle-star-2">✦</span>
      <span className="doodle-star doodle-star-3">★</span>
      <span className="doodle-star doodle-star-4">✦</span>
      <span className="doodle-heart doodle-heart-1">♡</span>
      <span className="doodle-heart doodle-heart-2">♥</span>
      <span className="wax-seal wax-seal-1">♥</span>
      <span className="wax-seal wax-seal-2">♥</span>
      <span className="stamp stamp-1">
        <span className="stamp-heart">♥</span>
        <span className="stamp-label">love</span>
      </span>
      <span className="stamp stamp-2">
        <span className="stamp-heart">♥</span>
        <span className="stamp-label">&apos;26</span>
      </span>

      <header className="nav">
        <Link href="/" className="logo">scrapbook<span className="logo-dot">.</span></Link>
        <nav className="nav-links nav-links-desktop">
          <Link href="/scrapbook/map" className="sticker sticker-yellow">🗺️ map</Link>
          <Link href="/friends" className="sticker sticker-pink">♡ friends</Link>
          <Link href="/groups" className="sticker sticker-pink">👯 groups</Link>
          <Link href="/scrapbook/add" className="sticker sticker-sage">+ add a place</Link>
          <UserMenu profile={profile} onLogout={logout} />
        </nav>
        <MobileNav
          profile={profile}
          onLogout={logout}
          links={[
            { href: "/scrapbook/add", label: "+ add a place" },
            { href: "/scrapbook/map", label: "🗺️ map" },
            { href: "/friends", label: "♡ friends" },
            { href: "/groups", label: "👯 groups" },
          ]}
        />
      </header>

      <main className="scrap-main">
        <header className="scrap-header memory-box-header">
          <p className="kicker">hey there,</p>
          <p className="possessive">{name}!</p>
          <h2 className="scrap-section-title">
            your <span className="squiggle">~</span> memory box
          </h2>
          <p className="scrap-subhead">
            {places.length === 0
              ? "empty for now — let's fix that ↓"
              : `${places.length} ${places.length === 1 ? "memory" : "memories"} taped in so far ✨`}
          </p>
        </header>

        {places.length > 0 && <StatsStrip stats={stats} />}

        {user && <FriendsFeed currentUserId={user.id} />}

        {places.length > 0 && (
          <section className="scrap-book-section">
            <LazyOnVisible
              rootMargin="400px"
              placeholder={<BookSkeleton />}
            >
              <MemoriesBook places={places} editable />
            </LazyOnVisible>
          </section>
        )}

        {recs.length > 0 && (
          <section className="recs-section">
            <h3 className="recs-section-title">✨ recommended for you</h3>
            <div className="recs-row">
              {recs.map((rec) => (
                <RecCard key={rec.id} rec={rec} onAdd={() => addRecToWishlist(rec)} onDismiss={() => dismissRec(rec)} />
              ))}
            </div>
          </section>
        )}

        {places.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <h3 className="scrap-grid-title">all your places</h3>
            <PlacesFilter
              filter={filter}
              setFilter={setFilter}
              query={query}
              setQuery={setQuery}
              counts={stats}
              shown={filteredPlaces.length}
            />
            {filteredPlaces.length === 0 ? (
              <div className="filter-empty">
                <p className="empty-emoji" style={{ fontSize: 50 }}>🔍</p>
                <p className="empty-sub">no places match that filter</p>
                <button onClick={() => { setFilter("all"); setQuery(""); }} className="btn btn-ghost">
                  clear filters
                </button>
              </div>
            ) : (
              <div className="place-grid">
                {filteredPlaces.map((p, i) => (
                  <PlaceCard key={p.id} place={p} index={i} onDelete={() => deletePlace(p)} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}

function BookSkeleton() {
  return (
    <div style={{
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "column",
      gap: 14,
      padding: 40,
    }}>
      <div style={{
        width: 160,
        height: 220,
        background: "linear-gradient(135deg, #7a4a25 0%, #3a2010 100%)",
        borderRadius: 4,
        boxShadow: "0 14px 30px rgba(0,0,0,0.25)",
        position: "relative",
      }}>
        <div style={{
          position: "absolute",
          inset: 14,
          border: "2px solid #d4af37",
          borderRadius: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#d4af37",
          fontFamily: "var(--ff-marker)",
          fontSize: 22,
          textAlign: "center",
          padding: 10,
        }}>
          Yours<br/>Truly
        </div>
      </div>
      <p style={{
        fontFamily: "var(--ff-caveat)",
        fontSize: 18,
        color: "var(--ink-soft)",
      }}>
        opening the book…
      </p>
    </div>
  );
}

function StatsStrip({ stats }) {
  const items = [
    { key: "total",       label: "memories",   count: stats.total,       tape: "yellow" },
    { key: "visited",     label: "been there", count: stats.visited,     tape: "sage" },
    { key: "wishlist",    label: "want to go", count: stats.wishlist,    tape: "pink" },
    { key: "recommended", label: "recommend",  count: stats.recommended, tape: "coral" },
  ];
  const tilts = [-2, 1.5, -1.5, 2];
  return (
    <div className="stats-strip">
      {items.map((s, i) => (
        <div key={s.key} className={`stat-chip stat-chip-${s.tape}`} style={{ transform: `rotate(${tilts[i]}deg)` }}>
          <span className={`stat-tape stat-tape-${s.tape}`} />
          <span className="stat-num">{s.count}</span>
          <span className="stat-label">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

const FILTER_OPTIONS = [
  { id: "all",         label: "all"          },
  { id: "visited",     label: "been there ✓" },
  { id: "wishlist",    label: "want to go +" },
  { id: "recommended", label: "recommend ★"  },
];

function PlacesFilter({ filter, setFilter, query, setQuery, counts, shown }) {
  const total = filter === "all" ? counts.total : counts[filter] ?? 0;
  const [nominatim, setNominatim] = useState([]);
  const [nomLoading, setNomLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setNominatim([]);
      setNomLoading(false);
      return;
    }
    setNomLoading(true);
    const timer = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&addressdetails=0&q=${encodeURIComponent(q)}`;
        const res = await fetch(url);
        const data = await res.json();
        setNominatim(data || []);
      } catch {
        setNominatim([]);
      } finally {
        setNomLoading(false);
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="places-filter">
      <div className="places-search-wrap">
        <input
          type="search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setDropdownOpen(true); }}
          onFocus={() => setDropdownOpen(true)}
          onBlur={() => setTimeout(() => setDropdownOpen(false), 200)}
          placeholder="🔍 search your places or anywhere on earth…"
          className="places-search"
        />
        {dropdownOpen && query.trim().length >= 3 && (
          <div className="map-search-dropdown">
            <p className="map-search-section">
              your places ({shown})
            </p>
            {shown === 0 ? (
              <p className="map-search-empty">none of yours match — try a world location below</p>
            ) : (
              <p className="map-search-empty" style={{ fontStyle: "italic" }}>
                see {shown} match{shown === 1 ? "" : "es"} in the grid
              </p>
            )}

            <p className="map-search-section">
              add somewhere new {nomLoading && "· searching…"}
            </p>
            {nominatim.length === 0 && !nomLoading ? (
              <p className="map-search-empty">type more to search world locations</p>
            ) : (
              <ul>
                {nominatim.map((r) => {
                  const shortName = r.display_name.split(",")[0];
                  const href = `/scrapbook/add?lat=${r.lat}&lng=${r.lon}&name=${encodeURIComponent(shortName)}&location=${encodeURIComponent(r.display_name)}`;
                  return (
                    <li key={`${r.osm_id}-${r.osm_type}`}>
                      <a
                        href={href}
                        className="map-search-result"
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        🌍 <strong>{shortName}</strong>
                        <br />
                        <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>
                          {r.display_name}
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
      <div className="places-filter-row">
        {FILTER_OPTIONS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`sticker ${filterStickerColor(f.id)} ${filter === f.id ? "sticker-active" : ""}`}
          >
            {f.label}
          </button>
        ))}
        <span className="places-filter-count">
          {shown === total ? `${shown}` : `${shown} of ${total}`} shown
        </span>
      </div>
    </div>
  );
}

function filterStickerColor(id) {
  if (id === "all")         return "sticker-yellow";
  if (id === "visited")     return "sticker-sage";
  if (id === "wishlist")    return "sticker-pink";
  if (id === "recommended") return "sticker-coral";
  return "sticker-pink";
}

function RecCard({ rec, onAdd, onDismiss }) {
  const place = rec.place;
  return (
    <article className="rec-card">
      <span className="rec-card-tape" />
      {place.photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={place.photo_url} alt={place.name} className="rec-card-photo" />
      ) : (
        <div className="rec-card-photo rec-card-photo-blank">📷</div>
      )}
      <div className="rec-card-body">
        <p className="rec-card-from">from {rec.senderName} ♡</p>
        <h4 className="rec-card-name">{place.name}</h4>
        {place.location && <p className="rec-card-loc">📍 {place.location}</p>}
        {rec.note && <p className="rec-card-note">&ldquo;{rec.note}&rdquo;</p>}
        <div className="rec-card-actions">
          <button onClick={onAdd} className="rec-add-btn">+ add to wishlist</button>
          <button onClick={onDismiss} className="rec-dismiss-btn">dismiss</button>
        </div>
      </div>
    </article>
  );
}

function EmptyState() {
  return (
    <div className="empty-state empty-state-big">
      <Link href="/scrapbook/add" className="empty-placeholder-polaroid" aria-label="add your first memory">
        <span className="empty-tape" />
        <div className="empty-frame">
          <span className="empty-plus">+</span>
          <p className="empty-frame-text">your first<br/>memory<br/>goes here</p>
        </div>
        <p className="empty-frame-caption">~ a place you love ~</p>
      </Link>
      <div className="empty-copy">
        <p className="empty-title">it&apos;s waiting for memories</p>
        <p className="empty-sub">
          a cafe you loved, a city that stuck, a spot you want to try.<br/>
          tape one in and watch this box fill up.
        </p>
        <Link href="/scrapbook/add" className="btn btn-primary">+ tape in your first memory</Link>
      </div>
    </div>
  );
}

const STATUS_META = {
  visited:     { label: "been there",  cls: "status-visited"     },
  wishlist:    { label: "want to go",  cls: "status-wishlist"    },
  recommended: { label: "recommend",   cls: "status-recommended" },
};

function PlaceCard({ place, index, onDelete }) {
  const router = useRouter();
  const tilt = [-3, 2, -2, 4, -4, 1, 3, -1][index % 8];
  const tapeKind = ["pink", "yellow", "sage"][index % 3];
  const meta = STATUS_META[place.status] || STATUS_META.visited;

  return (
    <motion.article
      className="place-card place-card-clickable"
      initial={{ opacity: 0, y: -60, rotate: 0, scale: 0.85 }}
      animate={{ opacity: 1, y: 0, rotate: tilt, scale: 1 }}
      transition={{
        delay: index * 0.08,
        type: "spring",
        stiffness: 160,
        damping: 14,
        mass: 0.8,
      }}
      whileHover={{ y: -6, rotate: 0, transition: { type: "spring", stiffness: 300, damping: 18 } }}
      style={{ "--tilt": `${tilt}deg` }}
      onClick={() => router.push(`/scrapbook/${place.id}`)}
    >
      <span className={`place-tape place-tape-${tapeKind}`} />

      {place.photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={place.photo_url} alt={place.name} className="place-photo" />
      ) : (
        <div className="place-photo place-photo-blank">
          <span>📷</span>
        </div>
      )}

      <span className={`place-status ${meta.cls}`}>{meta.label}</span>

      <div className="place-body">
        <h3 className="place-name">{place.name}</h3>
        {place.location && <p className="place-location">📍 {place.location}</p>}
        {place.rating > 0 && (
          <p className="place-stars" aria-label={`${place.rating} stars`}>
            {"★".repeat(place.rating)}<span className="place-stars-dim">{"★".repeat(5 - place.rating)}</span>
          </p>
        )}
        {place.review && <p className="place-review">{place.review}</p>}
      </div>

      <button
        className="place-delete"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        title="remove"
      >×</button>
    </motion.article>
  );
}
