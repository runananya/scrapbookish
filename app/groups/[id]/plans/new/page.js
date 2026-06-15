"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function NewPlanPage() {
  const { id } = useParams();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [locationName, setLocationName] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ text: "", type: "" });

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace(`/login?next=/groups/${id}/plans/new`);
        return;
      }
      setUser(user);
      const { data: g } = await supabase.from("groups").select("*").eq("id", id).maybeSingle();
      setGroup(g);
      setLoading(false);
    })();
  }, [id, router]);

  async function onSubmit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg({ text: "", type: "" });

    const supabase = createClient();
    const { data, error } = await supabase
      .from("plans")
      .insert({
        group_id: id,
        title: title.trim(),
        description: description.trim() || null,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
        location_name: locationName.trim() || null,
        location_address: locationAddress.trim() || null,
        created_by: user.id,
      })
      .select()
      .single();

    setBusy(false);
    if (error) {
      setMsg({ text: error.message, type: "error" });
      return;
    }
    router.push(`/groups/${id}/plans/${data.id}`);
  }

  if (loading) return <main className="auth-wrap"><p className="auth-sub">…</p></main>;

  return (
    <>
      <span className="tape tape-1" />
      <span className="doodle-star doodle-star-2">★</span>

      <header className="nav">
        <Link href="/" className="logo">scrapbook<span className="logo-dot">.</span></Link>
        <nav className="nav-links">
          <Link href={`/groups/${id}`} className="sticker sticker-pink">← back</Link>
        </nav>
      </header>

      <main className="add-place-wrap">
        <h1 className="auth-title">a new plan</h1>
        <p className="auth-sub">{group?.name && `for ${group.name} · `}let&apos;s make a thing happen</p>

        <form onSubmit={onSubmit} className="add-form">
          <label className="auth-label" htmlFor="p-title">what&apos;s the plan? *</label>
          <input
            id="p-title"
            className="auth-input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Goa trip · Sunday brunch · Sangeet"
            required
            maxLength={120}
          />

          <label className="auth-label" htmlFor="p-desc">a little more (optional)</label>
          <textarea
            id="p-desc"
            className="auth-input auth-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="what should everyone know?"
            rows={3}
            maxLength={600}
          />

          <label className="auth-label" htmlFor="p-starts">when does it start? *</label>
          <input
            id="p-starts"
            className="auth-input"
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            required
          />

          <label className="auth-label" htmlFor="p-ends">when does it end? (optional)</label>
          <input
            id="p-ends"
            className="auth-input"
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
          />

          <label className="auth-label" htmlFor="p-locname">where? — name of the place</label>
          <input
            id="p-locname"
            className="auth-input"
            type="text"
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
            placeholder="e.g. Toit"
            maxLength={120}
          />

          <label className="auth-label" htmlFor="p-locaddr">where? — address</label>
          <input
            id="p-locaddr"
            className="auth-input"
            type="text"
            value={locationAddress}
            onChange={(e) => setLocationAddress(e.target.value)}
            placeholder="Indiranagar, Bangalore"
            maxLength={200}
          />

          <div className="auth-row">
            <button type="submit" className="btn btn-primary" disabled={busy || !title.trim() || !startsAt}>
              {busy ? "making the plan…" : "make the plan →"}
            </button>
          </div>

          {msg.text && <p className={`auth-msg ${msg.type}`}>{msg.text}</p>}
        </form>
      </main>
    </>
  );
}
