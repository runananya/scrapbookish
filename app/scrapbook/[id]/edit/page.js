"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const MapPicker = dynamic(() => import("@/components/MapPicker"), { ssr: false });

const STATUSES = [
  { id: "visited",     label: "been there ✓",  sticker: "sticker-pink"   },
  { id: "wishlist",    label: "want to go +",  sticker: "sticker-yellow" },
  { id: "recommended", label: "recommend ★",   sticker: "sticker-sage"   },
];

export default function EditPlacePage() {
  const { id } = useParams();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ text: "", type: "" });

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [coords, setCoords] = useState(null);
  const [status, setStatus] = useState("visited");
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace(`/login?next=/scrapbook/${id}/edit`);
        return;
      }
      const { data: place, error } = await supabase
        .from("places")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error || !place) {
        setMsg({ text: "couldn't load this place", type: "error" });
        setLoading(false);
        return;
      }
      if (place.user_id !== user.id) {
        router.replace(`/scrapbook/${id}`);
        return;
      }
      setUser(user);
      setName(place.name || "");
      setLocation(place.location || "");
      setStatus(place.status || "visited");
      setRating(place.rating || 0);
      setReview(place.review || "");
      if (place.lat != null && place.lng != null) {
        setCoords({ lat: place.lat, lng: place.lng, label: place.location });
      }
      setLoading(false);
    })();
  }, [id, router]);

  async function onSubmit(e) {
    e.preventDefault();
    if (saving || !name.trim()) return;
    setSaving(true);
    setMsg({ text: "saving…", type: "success" });

    const supabase = createClient();
    const { error } = await supabase
      .from("places")
      .update({
        name: name.trim(),
        location: location.trim() || coords?.label || null,
        rating: status === "wishlist" ? null : (rating || null),
        review: review.trim() || null,
        status,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
      })
      .eq("id", id);

    setSaving(false);
    if (error) {
      setMsg({ text: error.message, type: "error" });
      return;
    }
    router.push(`/scrapbook/${id}`);
  }

  if (loading) return <main className="auth-wrap"><p className="auth-sub">opening for editing…</p></main>;

  const ratingApplies = status !== "wishlist";

  return (
    <>
      <span className="tape tape-1" />
      <span className="doodle-star doodle-star-2">★</span>

      <header className="nav">
        <Link href={`/scrapbook/${id}`} className="logo">scrapbook<span className="logo-dot">.</span></Link>
        <nav className="nav-links">
          <Link href={`/scrapbook/${id}`} className="sticker sticker-pink">← cancel</Link>
        </nav>
      </header>

      <main className="add-place-wrap">
        <h1 className="auth-title">edit this memory</h1>
        <p className="auth-sub">change anything except the photos (for now)</p>

        <form onSubmit={onSubmit} className="add-form">
          <label className="auth-label" htmlFor="e-name">name of the place *</label>
          <input
            id="e-name"
            className="auth-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={120}
          />

          <label className="auth-label" htmlFor="e-loc">where is it?</label>
          <input
            id="e-loc"
            className="auth-input"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            maxLength={160}
          />

          <p className="auth-label">pin on the map</p>
          <MapPicker value={coords} onChange={setCoords} />

          <p className="auth-label">how do you know it?</p>
          <div className="status-row">
            {STATUSES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStatus(s.id)}
                className={`sticker ${s.sticker} ${status === s.id ? "sticker-active" : ""}`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {ratingApplies && (
            <>
              <p className="auth-label">your rating</p>
              <div className="star-rating" role="radiogroup">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n === rating ? 0 : n)}
                    className={`star ${n <= rating ? "star-filled" : ""}`}
                    aria-label={`${n} star${n > 1 ? "s" : ""}`}
                  >★</button>
                ))}
              </div>
            </>
          )}

          <label className="auth-label" htmlFor="e-review">your review</label>
          <textarea
            id="e-review"
            className="auth-input auth-textarea"
            value={review}
            onChange={(e) => setReview(e.target.value)}
            rows={4}
            maxLength={800}
          />

          <p className="auth-msg" style={{ color: "var(--ink-soft)", fontSize: 16, textAlign: "left" }}>
            📷 to change photos: for now, you&apos;d need to delete and re-add. proper photo-management UI coming later.
          </p>

          <div className="auth-row">
            <button type="submit" className="btn btn-primary" disabled={saving || !name.trim()}>
              {saving ? "saving…" : "save changes ✨"}
            </button>
          </div>

          {msg.text && <p className={`auth-msg ${msg.type}`}>{msg.text}</p>}
        </form>
      </main>
    </>
  );
}
