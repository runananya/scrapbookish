"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const PlacesMap = dynamic(() => import("@/components/PlacesMap"), { ssr: false });

const STATUS_META = {
  visited:     { label: "been there",  cls: "status-visited"     },
  wishlist:    { label: "want to go",  cls: "status-wishlist"    },
  recommended: { label: "recommend",   cls: "status-recommended" },
};

export default function PlaceDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [place, setPlace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      setUser(user);
      const { data, error } = await supabase
        .from("places")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) {
        setPlace(null);
      } else {
        setPlace(data);
      }
      setLoading(false);
    })();
  }, [id, router]);

  async function deletePlace() {
    if (!confirm(`remove "${place.name}" from your scrapbook?`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("places").delete().eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }
    router.push("/scrapbook");
  }

  if (loading) return <main className="auth-wrap"><p className="auth-sub">opening the memory…</p></main>;
  if (!place) return (
    <main className="auth-wrap">
      <p className="auth-msg error">this memory doesn&apos;t exist anymore</p>
      <p className="auth-switch"><Link href="/scrapbook">← back to memory box</Link></p>
    </main>
  );

  const meta = STATUS_META[place.status] || STATUS_META.visited;
  const photos = Array.isArray(place.photos) && place.photos.length > 0
    ? place.photos
    : (place.photo_url ? [place.photo_url] : []);
  const isMine = user && place.user_id === user.id;
  const hasCoords = place.lat != null && place.lng != null;

  return (
    <>
      <span className="tape tape-1" />
      <span className="doodle-star doodle-star-1">★</span>
      <span className="doodle-heart doodle-heart-1">♡</span>

      <header className="nav">
        <Link href="/scrapbook" className="logo">scrapbook<span className="logo-dot">.</span></Link>
        <nav className="nav-links">
          <Link href="/scrapbook" className="sticker sticker-pink">← memory box</Link>
        </nav>
      </header>

      <main className="place-detail">
        <header className="place-detail-header">
          <span className={`place-status place-detail-status ${meta.cls}`}>{meta.label}</span>
          <h1 className="place-detail-name">{place.name}</h1>
          {place.location && <p className="place-detail-location">📍 {place.location}</p>}
          {place.rating > 0 && (
            <p className="place-detail-stars">
              {"★".repeat(place.rating)}<span className="place-stars-dim">{"★".repeat(5 - place.rating)}</span>
            </p>
          )}
        </header>

        {photos.length > 0 && (
          <section className="place-photo-scatter">
            {photos.map((src, i) => (
              <div
                key={i}
                className="place-detail-polaroid"
                style={{
                  transform: `rotate(${[-5, 3, -2, 4, -4, 2][i % 6]}deg)`,
                  zIndex: photos.length - i,
                }}
              >
                <span className={`place-tape place-tape-${["pink", "yellow", "sage", "peach"][i % 4]}`} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" />
              </div>
            ))}
          </section>
        )}

        {place.review && (
          <section className="place-review-card">
            <p className="place-review-label">~ a note ~</p>
            <p className="place-review-text">{place.review}</p>
          </section>
        )}

        {hasCoords && (
          <section className="place-detail-map">
            <p className="auth-label">on the map</p>
            <div className="place-detail-mapstage">
              <PlacesMap places={[place]} />
            </div>
          </section>
        )}

        {isMine && (
          <div className="place-detail-actions">
            <button onClick={deletePlace} className="btn btn-ghost place-detail-delete">
              🗑 remove from scrapbook
            </button>
          </div>
        )}
      </main>
    </>
  );
}
