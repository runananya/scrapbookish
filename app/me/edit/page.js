"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";

export default function EditProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ text: "", type: "" });

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login?next=/me/edit");
        return;
      }
      setUser(user);
      const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      setProfile(p);
      setDisplayName(p?.display_name || "");
      setPhotoPreview(p?.avatar_url || "");
      setLoading(false);
    })();
  }, [router]);

  function onPickPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function save(e) {
    e.preventDefault();
    if (!user || saving) return;
    setSaving(true);
    setMsg({ text: "", type: "" });

    const supabase = createClient();
    let avatar_url = profile?.avatar_url || null;

    try {
      if (photoFile) {
        setMsg({ text: "uploading photo…", type: "success" });
        const blob = await resizeAvatar(photoFile, 240);
        const path = `${user.id}/avatar-${Date.now()}.jpg`;
        const { error: upErr } = await supabase
          .storage
          .from("place-photos")
          .upload(path, blob, { contentType: "image/jpeg", cacheControl: "3600", upsert: false });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("place-photos").getPublicUrl(path);
        avatar_url = urlData.publicUrl;
      }

      const { error: upErr2 } = await supabase
        .from("profiles")
        .update({ display_name: displayName.trim() || null, avatar_url })
        .eq("id", user.id);
      if (upErr2) throw upErr2;

      setMsg({ text: "saved ✨", type: "success" });
      // small delay then bounce to memory box
      setTimeout(() => router.push("/scrapbook"), 700);
    } catch (err) {
      setMsg({ text: err.message || "couldn't save", type: "error" });
      setSaving(false);
    }
  }

  if (loading) return <main className="auth-wrap"><p className="auth-sub">loading…</p></main>;

  return (
    <>
      <span className="tape tape-1" />
      <span className="doodle-star doodle-star-1">★</span>

      <header className="nav">
        <Link href="/" className="logo">scrapbook<span className="logo-dot">.</span></Link>
        <nav className="nav-links">
          <Link href="/scrapbook" className="sticker sticker-pink">← memory box</Link>
        </nav>
      </header>

      <main className="auth-wrap" style={{ maxWidth: 480 }}>
        <h1 className="auth-title">edit your profile</h1>
        <p className="auth-sub">your name + face show up everywhere</p>

        <form onSubmit={save}>
          <div className="profile-avatar-row">
            <Avatar profile={{ display_name: displayName, avatar_url: photoPreview }} size={120} />
            <label htmlFor="me-photo" className="upload-file-btn upload-file-btn-wide" style={{ marginTop: 14 }}>
              {photoPreview ? "✓ change photo" : "📷 pick a photo"}
            </label>
            <input
              id="me-photo"
              type="file"
              accept="image/*"
              onChange={onPickPhoto}
              className="upload-file-input"
            />
          </div>

          <label className="auth-label" htmlFor="me-name">your name</label>
          <input
            id="me-name"
            className="auth-input"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="what should friends call you?"
            maxLength={40}
            required
          />

          <div className="auth-row">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "saving…" : "save ✨"}
            </button>
          </div>

          {msg.text && <p className={`auth-msg ${msg.type}`}>{msg.text}</p>}
        </form>
      </main>
    </>
  );
}

async function resizeAvatar(file, size) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        // center square crop, scaled to `size`
        const crop = Math.min(img.width, img.height);
        const sx = (img.width - crop) / 2;
        const sy = (img.height - crop) / 2;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, sx, sy, crop, crop, 0, 0, size, size);
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
