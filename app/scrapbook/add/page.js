"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import CollageRenderer from "@/components/CollageRenderer";
import { domToBlob } from "modern-screenshot";

const MapPicker = dynamic(() => import("@/components/MapPicker"), { ssr: false });

const STATUSES = [
  { id: "visited",     label: "been there ✓",     sticker: "sticker-pink"   },
  { id: "wishlist",    label: "want to go +",     sticker: "sticker-yellow" },
  { id: "recommended", label: "recommend ★",      sticker: "sticker-sage"   },
];

const MAX_PHOTOS = 4;

export default function AddPlacePage() {
  return (
    <Suspense fallback={<main className="auth-wrap"><p className="auth-sub">…</p></main>}>
      <AddPlacePageInner />
    </Suspense>
  );
}

function AddPlacePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // initialize from URL params if present (when arriving from map "+ add" link)
  const [name, setName] = useState(() => searchParams.get("name") || "");
  const [location, setLocation] = useState(() => searchParams.get("location") || "");
  const [coords, setCoords] = useState(() => {
    const lat = parseFloat(searchParams.get("lat"));
    const lng = parseFloat(searchParams.get("lng"));
    if (!isNaN(lat) && !isNaN(lng)) {
      return { lat, lng, label: searchParams.get("location") || null };
    }
    return null;
  });
  const [status, setStatus] = useState("visited");
  const [photos, setPhotos] = useState([]); // [{ file, previewUrl, id }]
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [msg, setMsg] = useState({ text: "", type: "" });
  const [phase, setPhase] = useState("idle"); // idle | uploading | celebrating
  const [collagePreviewUrl, setCollagePreviewUrl] = useState("");
  const [renderUrls, setRenderUrls] = useState([]);
  const collageRef = useRef(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace("/login");
        return;
      }
      setUser(data.user);
      setLoading(false);
    });
  }, [router]);

  useEffect(() => () => {
    photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
  }, [photos]);

  function onPickPhotos(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const room = MAX_PHOTOS - photos.length;
    const accepted = files.slice(0, room).map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
    }));
    setPhotos((prev) => [...prev, ...accepted]);
    e.target.value = "";
  }

  function removePhoto(id) {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (phase !== "idle" || !user) return;
    setPhase("uploading");
    setMsg({ text: "", type: "" });

    const supabase = createClient();

    try {
      let collageUrl = null;
      let photoUrls = [];

      if (photos.length > 0) {
        setMsg({ text: "uploading photos…", type: "success" });

        // upload each original
        const uploads = await Promise.all(
          photos.map(async (p, idx) => {
            const blob = await resizeToBlob(p.file, 1600);
            const filename = `${user.id}/${Date.now()}-${idx}.jpg`;
            const { error } = await supabase
              .storage
              .from("place-photos")
              .upload(filename, blob, { contentType: "image/jpeg", cacheControl: "3600" });
            if (error) throw error;
            const { data } = supabase.storage.from("place-photos").getPublicUrl(filename);
            return data.publicUrl;
          })
        );
        photoUrls = uploads;

        // generate collage by snapshotting an off-screen HTML/CSS layout
        setMsg({ text: "making the collage…", type: "success" });
        setRenderUrls(photos.map((p) => p.previewUrl));
        // let React paint, fonts load, images decode
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        if (document.fonts?.ready) await document.fonts.ready;
        // belt-and-suspenders: also wait for the actual <div style="background-image"> to be there
        await new Promise((r) => setTimeout(r, 120));

        const collageBlob = await domToBlob(collageRef.current, {
          width: 900,
          height: 900,
          scale: 2,
          type: "image/jpeg",
          quality: 0.9,
        });
        const collageName = `${user.id}/${Date.now()}-collage.jpg`;
        const { error: cErr } = await supabase
          .storage
          .from("place-photos")
          .upload(collageName, collageBlob, { contentType: "image/jpeg", cacheControl: "3600" });
        if (cErr) throw cErr;
        const { data: cUrl } = supabase.storage.from("place-photos").getPublicUrl(collageName);
        collageUrl = cUrl.publicUrl;
        setCollagePreviewUrl(URL.createObjectURL(collageBlob));
      }

      setMsg({ text: "saving…", type: "success" });
      const { error: insErr } = await supabase.from("places").insert({
        user_id:   user.id,
        name:      name.trim(),
        location:  location.trim() || coords?.label || null,
        photo_url: collageUrl,
        photos:    photoUrls.length ? photoUrls : null,
        rating:    status === "wishlist" ? null : (rating || null),
        review:    review.trim() || null,
        status,
        lat:       coords?.lat ?? null,
        lng:       coords?.lng ?? null,
      });
      if (insErr) throw insErr;

      // celebrate, then redirect
      setPhase("celebrating");
      setMsg({ text: "", type: "" });
      setTimeout(() => router.push("/scrapbook"), 1800);
    } catch (err) {
      setMsg({ text: err.message || "something went wrong", type: "error" });
      setPhase("idle");
    }
  }

  if (loading) return <main className="auth-wrap"><p className="auth-sub">…</p></main>;

  const ratingApplies = status !== "wishlist";

  return (
    <>
      <span className="tape tape-1" />
      <span className="doodle-star doodle-star-2">★</span>
      <span className="wax-seal wax-seal-1">♥</span>

      <header className="nav">
        <Link href="/scrapbook" className="logo">scrapbook<span className="logo-dot">.</span></Link>
        <nav className="nav-links">
          <Link href="/scrapbook" className="sticker sticker-pink">← back</Link>
        </nav>
      </header>

      <main className="add-place-wrap">
        <h1 className="auth-title">add a memory</h1>
        <p className="auth-sub">tape it into your memory box</p>

        <form onSubmit={onSubmit} className="add-form">

          <label className="auth-label" htmlFor="p-name">name of the place *</label>
          <input
            id="p-name"
            className="auth-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Toit, Bangalore"
            required
            maxLength={120}
          />

          <label className="auth-label" htmlFor="p-loc">where is it?</label>
          <input
            id="p-loc"
            className="auth-input"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Indiranagar, Bangalore"
            maxLength={160}
          />

          <p className="auth-label">pin it on the map</p>
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

          <p className="auth-label">photos ({photos.length}/{MAX_PHOTOS})</p>
          {photos.length > 0 && (
            <div className="photo-preview-grid">
              {photos.map((p, i) => (
                <div key={p.id} className="photo-preview-tile" style={{ transform: `rotate(${[-4, 3, -2, 5][i]}deg)` }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.previewUrl} alt="" />
                  <button type="button" className="photo-remove" onClick={() => removePhoto(p.id)} title="remove">×</button>
                </div>
              ))}
            </div>
          )}
          {photos.length < MAX_PHOTOS && (
            <>
              <label htmlFor="p-photo" className="upload-file-btn upload-file-btn-wide">
                {photos.length === 0 ? "📷 pick photos" : `+ add another (${MAX_PHOTOS - photos.length} more)`}
              </label>
              <input
                id="p-photo"
                type="file"
                accept="image/*"
                multiple
                onChange={onPickPhotos}
                className="upload-file-input"
              />
            </>
          )}
          {photos.length > 1 && (
            <p className="auth-msg" style={{ color: "var(--sage)", textAlign: "left", margin: "4px 0 8px" }}>
              ✨ we&apos;ll auto-make a collage out of these when you tape it in
            </p>
          )}

          {ratingApplies && (
            <>
              <p className="auth-label">your rating</p>
              <StarRating value={rating} onChange={setRating} />
            </>
          )}

          <label className="auth-label" htmlFor="p-review">your review</label>
          <textarea
            id="p-review"
            className="auth-input auth-textarea"
            value={review}
            onChange={(e) => setReview(e.target.value)}
            placeholder="best butter chicken of my life — get the garlic naan too"
            rows={4}
            maxLength={800}
          />

          <div className="auth-row">
            <button type="submit" className="btn btn-primary" disabled={phase !== "idle" || !name.trim()}>
              {phase === "uploading" ? "taping in…" : "tape it into the box →"}
            </button>
          </div>

          {msg.text && <p className={`auth-msg ${msg.type}`}>{msg.text}</p>}
        </form>
      </main>

      {phase === "celebrating" && (
        <CelebrationOverlay collagePreviewUrl={collagePreviewUrl} />
      )}

      {/* off-screen collage stage for snapshot */}
      {renderUrls.length > 0 && (
        <div className="collage-stage">
          <CollageRenderer ref={collageRef} photos={renderUrls} label={name || "memories"} />
        </div>
      )}
    </>
  );
}

function CelebrationOverlay({ collagePreviewUrl }) {
  return (
    <div className="celebrate-overlay">
      <div className="celebrate-stage">
        {collagePreviewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={collagePreviewUrl} alt="" className="celebrate-collage" />
        ) : (
          <div className="celebrate-blank">📒</div>
        )}
        <div className="celebrate-tape" />
        <div className="celebrate-tape celebrate-tape-2" />
      </div>
      <p className="celebrate-text">✨ taped into your memory box ✨</p>
    </div>
  );
}

function StarRating({ value, onChange }) {
  return (
    <div className="star-rating" role="radiogroup" aria-label="rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`star ${n <= value ? "star-filled" : ""}`}
          onClick={() => onChange(n === value ? 0 : n)}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

async function resizeToBlob(file, maxWidth) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("blob failed"))),
          "image/jpeg",
          0.88
        );
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
