"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

export default function ScrapbookPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
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
        .order("created_at", { ascending: false });
      setPlaces(data || []);
      setLoading(false);
    })();
  }, [router]);

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

  const name = user.user_metadata?.display_name || user.email?.split("@")[0] || "friend";

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
        <nav className="nav-links">
          <Link href="/scrapbook/map" className="sticker sticker-yellow">🗺️ map</Link>
          <Link href="/groups" className="sticker sticker-pink">👯 groups</Link>
          <Link href="/scrapbook/add" className="sticker sticker-sage">+ add a place</Link>
          <button onClick={logout} className="sticker sticker-pink sticker-btn">log out</button>
        </nav>
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

        {places.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="place-grid">
            {places.map((p, i) => (
              <PlaceCard key={p.id} place={p} index={i} onDelete={() => deletePlace(p)} />
            ))}
          </div>
        )}
      </main>
    </>
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
