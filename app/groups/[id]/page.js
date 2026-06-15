"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const STATUS_META = {
  visited:     { label: "been there",  cls: "status-visited"     },
  wishlist:    { label: "want to go",  cls: "status-wishlist"    },
  recommended: { label: "recommend",   cls: "status-recommended" },
};

export default function GroupDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [places, setPlaces] = useState([]); // [{ group_places row, place }]
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => { load(); }, [id]); // eslint-disable-line

  async function load() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace(`/login?next=/groups/${id}`);
      return;
    }
    setUser(user);

    // group row
    const { data: g, error: gErr } = await supabase
      .from("groups")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (gErr || !g) {
      setError("this group doesn't exist (or RLS is blocking the read)");
      setLoading(false);
      return;
    }
    setGroup(g);

    // members — join to auth via profiles
    const { data: m } = await supabase
      .from("group_members")
      .select("user_id, role, joined_at")
      .eq("group_id", id);

    // get display names from profiles
    const memberIds = (m || []).map((r) => r.user_id);
    let profileMap = {};
    if (memberIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", memberIds);
      profileMap = Object.fromEntries((profs || []).map((p) => [p.id, p]));
    }
    setMembers(
      (m || []).map((r) => ({
        ...r,
        display_name: profileMap[r.user_id]?.display_name || "someone",
      }))
    );

    // plans (upcoming first, but show past too)
    const { data: planRows } = await supabase
      .from("plans")
      .select("*")
      .eq("group_id", id)
      .order("starts_at", { ascending: true });
    setPlans(planRows || []);

    // shared places
    const { data: gp } = await supabase
      .from("group_places")
      .select("place_id, added_by, added_at, note")
      .eq("group_id", id)
      .order("added_at", { ascending: false });

    if (gp && gp.length) {
      const placeIds = gp.map((r) => r.place_id);
      const { data: ps } = await supabase
        .from("places")
        .select("*")
        .in("id", placeIds);
      const placeMap = Object.fromEntries((ps || []).map((p) => [p.id, p]));
      setPlaces(
        gp.map((r) => ({ share: r, place: placeMap[r.place_id] })).filter((x) => x.place)
      );
    } else {
      setPlaces([]);
    }

    setLoading(false);
  }

  async function copyInvite() {
    const url = `${window.location.origin}/groups/${id}/join`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt("copy this link:", url);
    }
  }

  async function unshare(placeId) {
    if (!confirm("remove this place from the group?")) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("group_places")
      .delete()
      .eq("group_id", id)
      .eq("place_id", placeId);
    if (error) { alert(error.message); return; }
    setPlaces((prev) => prev.filter((x) => x.place.id !== placeId));
  }

  if (loading) return <main className="auth-wrap"><p className="auth-sub">loading group…</p></main>;
  if (error)   return (
    <main className="auth-wrap">
      <p className="auth-msg error">{error}</p>
      <p className="auth-switch"><Link href="/groups">← back to groups</Link></p>
    </main>
  );

  const isMember = members.some((m) => m.user_id === user.id);

  return (
    <>
      <span className="tape tape-2" />
      <span className="doodle-heart doodle-heart-1">♡</span>

      <header className="nav">
        <Link href="/" className="logo">scrapbook<span className="logo-dot">.</span></Link>
        <nav className="nav-links">
          <Link href="/groups" className="sticker sticker-pink">← groups</Link>
        </nav>
      </header>

      <main className="scrap-main">
        <header className="scrap-header">
          <p className="kicker">the</p>
          <h2 className="scrap-section-title">{group.name}</h2>
          <div className="group-actions">
            <button onClick={copyInvite} className="btn btn-ghost">
              {copied ? "✓ link copied!" : "📋 copy invite link"}
            </button>
            <Link href={`/groups/${id}/share`} className="btn btn-primary">+ share places</Link>
            <Link href={`/groups/${id}/plans/new`} className="btn btn-primary">📅 make a plan</Link>
          </div>
        </header>

        {plans.length > 0 && (
          <section style={{ marginBottom: 40 }}>
            <p className="auth-label" style={{ marginTop: 0 }}>plans ({plans.length})</p>
            <ul className="plans-list">
              {plans.map((p) => (
                <li key={p.id}>
                  <Link href={`/groups/${id}/plans/${p.id}`} className="plan-row">
                    <PlanDate iso={p.starts_at} />
                    <div className="plan-row-body">
                      <strong className="plan-row-title">{p.title}</strong>
                      {p.location_name && <span className="plan-row-loc">📍 {p.location_name}</span>}
                    </div>
                    <span className="plan-row-arrow">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="group-members">
          <p className="auth-label" style={{ marginTop: 0 }}>members ({members.length})</p>
          <ul className="members-list">
            {members.map((m) => (
              <li key={m.user_id} className={`member-chip ${m.role === "admin" ? "member-admin" : ""}`}>
                {m.display_name}
                {m.role === "admin" && <span className="member-admin-tag">admin</span>}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <p className="auth-label">shared places ({places.length})</p>
          {places.length === 0 ? (
            <div className="empty-state" style={{ padding: "40px 24px" }}>
              <p className="empty-emoji" style={{ fontSize: 50 }}>📍</p>
              <p className="empty-sub">no places shared yet — be the first!</p>
              <Link href={`/groups/${id}/share`} className="btn btn-primary">+ share places</Link>
            </div>
          ) : (
            <div className="place-grid">
              {places.map((x, i) => (
                <SharedPlaceCard
                  key={x.place.id}
                  place={x.place}
                  share={x.share}
                  addedByName={members.find((m) => m.user_id === x.share.added_by)?.display_name}
                  isMine={x.share.added_by === user.id}
                  index={i}
                  onUnshare={() => unshare(x.place.id)}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}

function PlanDate({ iso }) {
  const d = new Date(iso);
  const month = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  const day = d.getDate();
  return (
    <div className="plan-date-box">
      <span className="plan-date-month">{month}</span>
      <span className="plan-date-day">{day}</span>
    </div>
  );
}

function SharedPlaceCard({ place, share, addedByName, isMine, index, onUnshare }) {
  const tilt = [-3, 2, -2, 4, -4, 1, 3, -1][index % 8];
  const tapeKind = ["pink", "yellow", "sage"][index % 3];
  const meta = STATUS_META[place.status] || STATUS_META.visited;

  return (
    <article className="place-card" style={{ transform: `rotate(${tilt}deg)` }}>
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
        <p className="shared-by">shared by {addedByName || "someone"}</p>
      </div>

      {isMine && (
        <button className="place-delete" onClick={onUnshare} title="unshare">×</button>
      )}
    </article>
  );
}
