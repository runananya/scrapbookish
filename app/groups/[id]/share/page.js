"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ShareToGroupPage() {
  const { id } = useParams();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [group, setGroup] = useState(null);
  const [places, setPlaces] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [alreadyShared, setAlreadyShared] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ text: "", type: "" });

  useEffect(() => { load(); }, [id]); // eslint-disable-line

  async function load() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    setUser(user);

    const { data: g } = await supabase.from("groups").select("*").eq("id", id).maybeSingle();
    setGroup(g);

    const [{ data: ps }, { data: existing }] = await Promise.all([
      supabase.from("places").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("group_places").select("place_id").eq("group_id", id),
    ]);

    setPlaces(ps || []);
    setAlreadyShared(new Set((existing || []).map((r) => r.place_id)));
    setLoading(false);
  }

  function toggle(placeId) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(placeId)) next.delete(placeId); else next.add(placeId);
      return next;
    });
  }

  async function save() {
    if (selected.size === 0 || saving) return;
    setSaving(true);
    setMsg({ text: "", type: "" });
    const supabase = createClient();
    const rows = Array.from(selected).map((place_id) => ({
      group_id: id,
      place_id,
      added_by: user.id,
    }));
    const { error } = await supabase.from("group_places").insert(rows);
    setSaving(false);
    if (error) {
      setMsg({ text: error.message, type: "error" });
      return;
    }
    router.push(`/groups/${id}`);
  }

  if (loading) return <main className="auth-wrap"><p className="auth-sub">loading your places…</p></main>;

  const shareable = places.filter((p) => !alreadyShared.has(p.id));

  return (
    <>
      <span className="tape tape-1" />

      <header className="nav">
        <Link href="/" className="logo">scrapbook<span className="logo-dot">.</span></Link>
        <nav className="nav-links">
          <Link href={`/groups/${id}`} className="sticker sticker-pink">← back</Link>
        </nav>
      </header>

      <main className="add-place-wrap" style={{ maxWidth: 720 }}>
        <h1 className="auth-title">share to {group?.name || "group"}</h1>
        <p className="auth-sub">pick which of your places to add</p>

        {shareable.length === 0 ? (
          <div className="empty-state">
            <p className="empty-emoji">📍</p>
            <p className="empty-sub">
              {places.length === 0
                ? "you don't have any places yet — add one first"
                : "all your places are already shared with this group!"}
            </p>
            <Link href="/scrapbook/add" className="btn btn-primary">+ add a place</Link>
          </div>
        ) : (
          <>
            <ul className="share-list">
              {shareable.map((p) => (
                <li key={p.id} className={`share-item ${selected.has(p.id) ? "share-item-picked" : ""}`}>
                  <label>
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggle(p.id)}
                    />
                    {p.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.photo_url} alt="" className="share-thumb" />
                    ) : (
                      <div className="share-thumb share-thumb-blank">📷</div>
                    )}
                    <div className="share-meta">
                      <strong className="share-name">{p.name}</strong>
                      {p.location && <span className="share-loc">📍 {p.location}</span>}
                    </div>
                  </label>
                </li>
              ))}
            </ul>

            <div className="auth-row">
              <button onClick={save} className="btn btn-primary" disabled={selected.size === 0 || saving}>
                {saving ? "sharing…" : `share ${selected.size} place${selected.size === 1 ? "" : "s"} →`}
              </button>
            </div>
            {msg.text && <p className={`auth-msg ${msg.type}`}>{msg.text}</p>}
          </>
        )}
      </main>
    </>
  );
}
