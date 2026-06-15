"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

export default function RecommendModal({ place, currentUserId, onClose, onSent }) {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState(new Set());
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState({ text: "", type: "" });

  useEffect(() => { loadFriends(); }, []); // eslint-disable-line

  async function loadFriends() {
    const supabase = createClient();

    const { data: myGroups } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", currentUserId);

    const groupIds = (myGroups || []).map((g) => g.group_id);
    if (groupIds.length === 0) {
      setFriends([]);
      setLoading(false);
      return;
    }

    const { data: allMembers } = await supabase
      .from("group_members")
      .select("user_id, group_id")
      .in("group_id", groupIds);

    const otherUserIds = Array.from(
      new Set((allMembers || []).map((m) => m.user_id).filter((id) => id !== currentUserId))
    );

    if (otherUserIds.length === 0) {
      setFriends([]);
      setLoading(false);
      return;
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", otherUserIds);

    setFriends((profiles || []).map((p) => ({ id: p.id, name: p.display_name || "friend" })));
    setLoading(false);
  }

  function togglePick(id) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function send() {
    if (sending || picked.size === 0) return;
    setSending(true);
    setMsg({ text: "", type: "" });

    const supabase = createClient();
    const rows = Array.from(picked).map((to_user_id) => ({
      place_id: place.id,
      from_user_id: currentUserId,
      to_user_id,
      note: note.trim() || null,
    }));
    const { error } = await supabase.from("recommendations").insert(rows);
    setSending(false);

    if (error) {
      const text = error.code === "23505" ? "already recommended to one of these friends!" : error.message;
      setMsg({ text, type: "error" });
      return;
    }
    onSent?.(picked.size);
  }

  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="modal-card rec-modal"
        initial={{ y: 40, opacity: 0, rotate: -3, scale: 0.92 }}
        animate={{ y: 0, opacity: 1, rotate: -1, scale: 1 }}
        exit={{ y: 40, opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 200, damping: 18 }}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="modal-tape" />
        <h2 className="modal-title">recommend</h2>
        <p className="modal-sub">tape <strong>{place.name}</strong> onto a friend&apos;s scrapbook</p>

        {loading ? (
          <p className="auth-sub" style={{ margin: "20px 0" }}>loading friends…</p>
        ) : friends.length === 0 ? (
          <div style={{ padding: "20px 0", textAlign: "center" }}>
            <p className="auth-sub">no friends to send to yet</p>
            <p className="auth-sub" style={{ fontSize: 18 }}>
              join a group with someone (or invite them) — then recommend.
            </p>
          </div>
        ) : (
          <>
            <p className="auth-label">pick who to recommend to</p>
            <ul className="rec-friend-list">
              {friends.map((f) => (
                <li key={f.id} className={`rec-friend ${picked.has(f.id) ? "rec-friend-picked" : ""}`}>
                  <label>
                    <input
                      type="checkbox"
                      checked={picked.has(f.id)}
                      onChange={() => togglePick(f.id)}
                    />
                    <span className="rec-friend-name">{f.name}</span>
                  </label>
                </li>
              ))}
            </ul>

            <label className="auth-label" htmlFor="rec-note">a little note (optional)</label>
            <textarea
              id="rec-note"
              className="auth-input auth-textarea"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="you'll love it — order the garlic naan"
              rows={3}
              maxLength={400}
            />

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={send}
                disabled={picked.size === 0 || sending}
              >
                {sending ? "sending…" : `recommend to ${picked.size || "…"}`}
              </button>
            </div>
            {msg.text && <p className={`auth-msg ${msg.type}`}>{msg.text}</p>}
          </>
        )}

        <button onClick={onClose} className="rec-modal-close" aria-label="close">×</button>
      </motion.div>
    </motion.div>
  );
}
