"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";

const MemoriesBook = dynamic(() => import("@/components/MemoriesBook"), { ssr: false });

const STATUS_META = {
  visited:     { label: "been there",  cls: "status-visited"     },
  wishlist:    { label: "want to go",  cls: "status-wishlist"    },
  recommended: { label: "recommend",   cls: "status-recommended" },
};

export default function ProfilePage() {
  const { id } = useParams();
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [profile, setProfile] = useState(null);
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace(`/login?next=/u/${id}`);
        return;
      }
      setMe(user);

      const [{ data: p }, { data: pls }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
        supabase.from("places").select("*").eq("user_id", id).order("created_at", { ascending: false }),
      ]);

      setProfile(p);
      setPlaces(pls || []);
      setLoading(false);
    })();
  }, [id, router]);

  if (loading) return <main className="auth-wrap"><p className="auth-sub">opening their scrapbook…</p></main>;

  // viewing yourself? redirect to your own memory box
  if (me?.id === id) {
    router.replace("/scrapbook");
    return null;
  }

  if (!profile) return (
    <main className="auth-wrap">
      <p className="auth-msg error">this person doesn&apos;t exist</p>
      <p className="auth-switch"><Link href="/scrapbook">← back to yours</Link></p>
    </main>
  );

  const displayName = profile.display_name || "friend";

  return (
    <>
      <span className="tape tape-1" />
      <span className="tape tape-2" />
      <span className="doodle-heart doodle-heart-1">♡</span>
      <span className="doodle-star doodle-star-1">★</span>

      <header className="nav">
        <Link href="/" className="logo">scrapbook<span className="logo-dot">.</span></Link>
        <nav className="nav-links">
          <Link href="/scrapbook" className="sticker sticker-pink">← your scrapbook</Link>
        </nav>
      </header>

      <main className="scrap-main">
        <header className="scrap-header" style={{ textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <Avatar profile={profile} size={88} />
          </div>
          <p className="kicker">you&apos;re peeking into</p>
          <p className="possessive">{displayName}&apos;s</p>
          <h2 className="scrap-section-title">memory box</h2>
          <p className="scrap-subhead">
            {places.length === 0
              ? "their scrapbook is empty for now"
              : `${places.length} ${places.length === 1 ? "memory" : "memories"} taped in`}
          </p>
        </header>

        {places.length > 0 && (
          <section className="scrap-book-section">
            <MemoriesBook places={places} />
          </section>
        )}

        {places.length > 0 ? (
          <>
            <h3 className="scrap-grid-title">all their places</h3>
            <div className="place-grid">
              {places.map((p, i) => (
                <ProfilePlaceCard key={p.id} place={p} index={i} />
              ))}
            </div>
          </>
        ) : (
          <div className="empty-state">
            <p className="empty-emoji">📷</p>
            <p className="empty-title">nothing taped in yet</p>
            <p className="empty-sub">{displayName} hasn&apos;t added any places to their scrapbook</p>
          </div>
        )}
      </main>
    </>
  );
}

function ProfilePlaceCard({ place, index }) {
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
        <div className="place-photo place-photo-blank"><span>📷</span></div>
      )}
      <span className={`place-status ${meta.cls}`}>{meta.label}</span>
      <div className="place-body">
        <h3 className="place-name">{place.name}</h3>
        {place.location && <p className="place-location">📍 {place.location}</p>}
        {place.rating > 0 && (
          <p className="place-stars">
            {"★".repeat(place.rating)}<span className="place-stars-dim">{"★".repeat(5 - place.rating)}</span>
          </p>
        )}
        {place.review && <p className="place-review">{place.review}</p>}
      </div>
    </motion.article>
  );
}
