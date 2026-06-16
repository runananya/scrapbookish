"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Avatar from "./Avatar";

export default function FriendsFeed({ currentUserId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [currentUserId]); // eslint-disable-line

  async function load() {
    const supabase = createClient();

    // 1. Find friend user_ids: anyone in a group with me, deduplicated, excluding self
    const { data: myGroups } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", currentUserId);

    const groupIds = (myGroups || []).map((g) => g.group_id);
    if (groupIds.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    const { data: allMembers } = await supabase
      .from("group_members")
      .select("user_id")
      .in("group_id", groupIds);

    const friendIds = Array.from(
      new Set((allMembers || []).map((m) => m.user_id).filter((id) => id !== currentUserId))
    );

    if (friendIds.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    // 2. Recent places they added (last 14 days, up to 20)
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const [{ data: recentPlaces }, { data: incomingRecs }, { data: profiles }] = await Promise.all([
      supabase
        .from("places")
        .select("id, name, photo_url, location, user_id, created_at")
        .in("user_id", friendIds)
        .gte("created_at", fourteenDaysAgo)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("recommendations")
        .select("id, place_id, from_user_id, note, created_at, status")
        .eq("to_user_id", currentUserId)
        .gte("created_at", fourteenDaysAgo)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", friendIds),
    ]);

    const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));

    // Resolve recommendation places + senders
    const recPlaceIds = (incomingRecs || []).map((r) => r.place_id);
    let recPlaceMap = {};
    if (recPlaceIds.length) {
      const { data: rPlaces } = await supabase
        .from("places")
        .select("id, name, photo_url, location, user_id")
        .in("id", recPlaceIds);
      recPlaceMap = Object.fromEntries((rPlaces || []).map((p) => [p.id, p]));
    }

    const feed = [];

    (recentPlaces || []).forEach((p) => {
      feed.push({
        type: "added",
        ts: p.created_at,
        userProfile: profileMap[p.user_id] || { display_name: "friend" },
        userId: p.user_id,
        place: p,
        key: `add-${p.id}`,
      });
    });

    (incomingRecs || []).forEach((r) => {
      const place = recPlaceMap[r.place_id];
      if (!place) return;
      feed.push({
        type: "recommended",
        ts: r.created_at,
        userProfile: profileMap[r.from_user_id] || { display_name: "a friend" },
        userId: r.from_user_id,
        place,
        note: r.note,
        recId: r.id,
        recStatus: r.status,
        key: `rec-${r.id}`,
      });
    });

    feed.sort((a, b) => new Date(b.ts) - new Date(a.ts));
    setItems(feed.slice(0, 20));
    setLoading(false);
  }

  if (loading) return null;
  if (items.length === 0) return null;

  return (
    <section className="feed-section">
      <h3 className="feed-title">
        <span>✨ recent from your friends</span>
      </h3>
      <ul className="feed-list">
        {items.map((item) => <FeedItem key={item.key} item={item} />)}
      </ul>
    </section>
  );
}

function FeedItem({ item }) {
  const placeHref = `/scrapbook/${item.place.id}`;
  const name = item.userProfile?.display_name || "friend";
  return (
    <li className="feed-item">
      <Link href={`/u/${item.userId}`} className="feed-avatar-link">
        <Avatar profile={item.userProfile} size={42} />
      </Link>
      <div className="feed-body">
        <p className="feed-action">
          <Link href={`/u/${item.userId}`} className="feed-username">{name}</Link>
          {item.type === "added" && " added a memory · "}
          {item.type === "recommended" && " recommended this to you · "}
          <span className="feed-time">{timeAgo(item.ts)}</span>
        </p>
        <Link href={placeHref} className="feed-place-card">
          {item.place.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.place.photo_url} alt={item.place.name} className="feed-place-thumb" />
          ) : (
            <div className="feed-place-thumb feed-place-thumb-blank">📷</div>
          )}
          <div className="feed-place-meta">
            <strong>{item.place.name}</strong>
            {item.place.location && <span>📍 {item.place.location}</span>}
            {item.note && <em>&ldquo;{item.note}&rdquo;</em>}
          </div>
        </Link>
      </div>
    </li>
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
