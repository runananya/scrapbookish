"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function GroupsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState({ text: "", type: "" });

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    setUser(user);

    // get group_ids user belongs to, then groups, then counts
    const { data: memberships } = await supabase
      .from("group_members")
      .select("group_id, role")
      .eq("user_id", user.id);

    const ids = (memberships || []).map((m) => m.group_id);
    if (ids.length === 0) {
      setGroups([]);
      setLoading(false);
      return;
    }

    const { data: groupRows } = await supabase
      .from("groups")
      .select("id, name, created_at, created_by")
      .in("id", ids)
      .order("created_at", { ascending: false });

    // member counts
    const { data: counts } = await supabase
      .from("group_members")
      .select("group_id")
      .in("group_id", ids);

    const memberCount = {};
    (counts || []).forEach((r) => {
      memberCount[r.group_id] = (memberCount[r.group_id] || 0) + 1;
    });

    const { data: placeCounts } = await supabase
      .from("group_places")
      .select("group_id")
      .in("group_id", ids);

    const placeCount = {};
    (placeCounts || []).forEach((r) => {
      placeCount[r.group_id] = (placeCount[r.group_id] || 0) + 1;
    });

    setGroups(
      (groupRows || []).map((g) => ({
        ...g,
        member_count: memberCount[g.id] || 0,
        place_count:  placeCount[g.id]  || 0,
      }))
    );
    setLoading(false);
  }

  async function createGroup(e) {
    e.preventDefault();
    if (!newName.trim() || creating) return;
    setCreating(true);
    setMsg({ text: "", type: "" });
    const supabase = createClient();
    const { data, error } = await supabase
      .from("groups")
      .insert({ name: newName.trim(), created_by: user.id })
      .select()
      .single();
    setCreating(false);
    if (error) {
      setMsg({ text: error.message, type: "error" });
      return;
    }
    router.push(`/groups/${data.id}`);
  }

  if (loading) return <main className="auth-wrap"><p className="auth-sub">loading your groups…</p></main>;

  return (
    <>
      <span className="tape tape-1" />
      <span className="doodle-star doodle-star-2">✦</span>
      <span className="doodle-heart doodle-heart-1">♡</span>

      <header className="nav">
        <Link href="/" className="logo">scrapbook<span className="logo-dot">.</span></Link>
        <nav className="nav-links">
          <Link href="/scrapbook" className="sticker sticker-pink">← scrapbook</Link>
          <Link href="/scrapbook/map" className="sticker sticker-yellow">🗺️ map</Link>
        </nav>
      </header>

      <main className="scrap-main">
        <header className="scrap-header">
          <p className="kicker">your</p>
          <h2 className="scrap-section-title">groups <span className="squiggle">~</span></h2>
        </header>

        <section className="new-group-card">
          <p className="auth-sub">start a new one</p>
          <form onSubmit={createGroup} className="new-group-form">
            <input
              className="auth-input"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Bangalore brunch crew"
              maxLength={80}
              required
            />
            <button type="submit" className="btn btn-primary" disabled={!newName.trim() || creating}>
              {creating ? "making…" : "make group →"}
            </button>
          </form>
          {msg.text && <p className={`auth-msg ${msg.type}`}>{msg.text}</p>}
        </section>

        {groups.length === 0 ? (
          <div className="empty-state">
            <p className="empty-emoji">👯</p>
            <p className="empty-title">no groups yet</p>
            <p className="empty-sub">make one above, then share the link with friends</p>
          </div>
        ) : (
          <div className="group-grid">
            {groups.map((g, i) => (
              <GroupCard key={g.id} group={g} index={i} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}

function GroupCard({ group, index }) {
  const tilts = [-3, 2, -2, 3, -4, 1];
  const tilt = tilts[index % tilts.length];
  const colors = ["sticker-pink", "sticker-yellow", "sticker-sage"];
  const color = colors[index % colors.length];

  return (
    <Link href={`/groups/${group.id}`} className={`group-card ${color}`} style={{ transform: `rotate(${tilt}deg)` }}>
      <h3 className="group-card-name">{group.name}</h3>
      <p className="group-card-meta">
        {group.member_count} {group.member_count === 1 ? "member" : "members"} · {group.place_count} {group.place_count === 1 ? "place" : "places"}
      </p>
    </Link>
  );
}
