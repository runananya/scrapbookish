"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function PlaceComments({ placeId, currentUserId }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => { load(); }, [placeId]); // eslint-disable-line

  async function load() {
    const supabase = createClient();
    const { data: rows } = await supabase
      .from("place_comments")
      .select("*")
      .eq("place_id", placeId)
      .order("created_at", { ascending: false });

    const userIds = Array.from(new Set((rows || []).map((r) => r.user_id)));
    let nameMap = {};
    if (userIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", userIds);
      nameMap = Object.fromEntries((profs || []).map((p) => [p.id, p.display_name || "friend"]));
    }
    setComments((rows || []).map((r) => ({ ...r, authorName: nameMap[r.user_id] || "friend" })));
    setLoading(false);
  }

  async function post(e) {
    e.preventDefault();
    if (!draft.trim() || posting) return;
    setPosting(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("place_comments")
      .insert({ place_id: placeId, user_id: currentUserId, content: draft.trim() });
    setPosting(false);
    if (error) { alert(error.message); return; }
    setDraft("");
    load();
  }

  async function remove(commentId) {
    if (!window.confirm("delete this note?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("place_comments").delete().eq("id", commentId);
    if (error) { alert(error.message); return; }
    setComments((c) => c.filter((x) => x.id !== commentId));
  }

  return (
    <section className="comments-section">
      <h3 className="comments-title">
        💬 friend notes <span style={{ fontSize: 18, color: "var(--ink-soft)" }}>({comments.length})</span>
      </h3>

      {currentUserId && (
        <form onSubmit={post} className="comment-form">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="leave a note for the scrapbook…"
            className="comment-input"
            rows={2}
            maxLength={400}
            disabled={posting}
          />
          <button type="submit" className="btn btn-primary" disabled={!draft.trim() || posting}>
            {posting ? "pinning…" : "pin note ✨"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="auth-sub" style={{ marginTop: 16 }}>loading notes…</p>
      ) : comments.length === 0 ? (
        <p className="comments-empty">no notes yet — be the first ♡</p>
      ) : (
        <ul className="comments-list">
          {comments.map((c, i) => (
            <li
              key={c.id}
              className="comment-card"
              style={{ transform: `rotate(${[-2, 1, -1, 2][i % 4]}deg)` }}
            >
              <span className={`comment-tape comment-tape-${["pink", "yellow", "sage"][i % 3]}`} />
              <p className="comment-text">{c.content}</p>
              <p className="comment-meta">
                — <Link href={`/u/${c.user_id}`}>{c.authorName}</Link>
                <span className="comment-time"> · {timeAgo(c.created_at)}</span>
                {c.user_id === currentUserId && (
                  <button onClick={() => remove(c.id)} className="comment-delete" title="remove">×</button>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function timeAgo(iso) {
  const t = new Date(iso).getTime();
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
