"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";

export default function FriendsPage() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(new Set());
  const [copied, setCopied] = useState(false);

  useEffect(() => { load(); }, []); // eslint-disable-line

  async function load() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/login?next=/friends");
      return;
    }
    setMe(user);

    // friends = unique users in any group I'm in (excluding me)
    const { data: myGroups } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", user.id);

    const groupIds = (myGroups || []).map((g) => g.group_id);
    if (groupIds.length === 0) {
      setFriends([]);
      setLoading(false);
      return;
    }

    const { data: allMembers } = await supabase
      .from("group_members")
      .select("user_id")
      .in("group_id", groupIds);

    const friendIds = Array.from(
      new Set((allMembers || []).map((m) => m.user_id).filter((id) => id !== user.id))
    );

    if (friendIds.length === 0) {
      setFriends([]);
      setLoading(false);
      return;
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url, created_at")
      .in("id", friendIds)
      .order("display_name");

    setFriends(profiles || []);
    setLoading(false);
  }

  // debounced search by display_name
  const friendIdSet = useMemo(() => new Set(friends.map((f) => f.id)), [friends]);
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .ilike("display_name", `%${q}%`)
        .limit(12);
      const filtered = (data || []).filter((p) => p.id !== me?.id && !friendIdSet.has(p.id));
      setSearchResults(filtered);
      setSearching(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [query, me, friendIdSet]);

  async function addFriend(userId) {
    if (adding.has(userId)) return;
    setAdding((s) => new Set(s).add(userId));
    const supabase = createClient();
    const { error } = await supabase.rpc("create_friendship", { friend_user_id: userId });
    setAdding((s) => { const n = new Set(s); n.delete(userId); return n; });
    if (error) {
      alert(error.message);
      return;
    }
    // bump them from search results, reload friends
    setSearchResults((r) => r.filter((p) => p.id !== userId));
    load();
  }

  async function copyMyLink() {
    if (!me) return;
    const url = `${window.location.origin}/friend/${me.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      window.prompt("copy your friend link:", url);
    }
  }

  if (loading) {
    return <main className="auth-wrap"><p className="auth-sub">loading your friends…</p></main>;
  }

  return (
    <>
      <span className="tape tape-1" />
      <span className="doodle-heart doodle-heart-1">♡</span>
      <span className="doodle-star doodle-star-1">★</span>

      <header className="nav">
        <Link href="/" className="logo">scrapbook<span className="logo-dot">.</span></Link>
        <nav className="nav-links">
          <Link href="/scrapbook" className="sticker sticker-pink">← memory box</Link>
        </nav>
      </header>

      <main className="scrap-main">
        <header className="scrap-header">
          <p className="kicker">your</p>
          <h2 className="scrap-section-title">friends ♡</h2>
          <p className="scrap-subhead">{friends.length} {friends.length === 1 ? "person" : "people"} sharing scrapbooks with you</p>
        </header>

        <section className="friend-share-card">
          <p className="auth-label" style={{ marginTop: 0 }}>your share link</p>
          <p className="friend-share-hint">send this to anyone — one click and they&apos;re your friend</p>
          <button onClick={copyMyLink} className="btn btn-primary friend-share-btn">
            {copied ? "✓ link copied!" : "🔗 copy my friend link"}
          </button>
        </section>

        <section className="friend-search">
          <p className="auth-label">find someone by name</p>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="🔍 search by name…"
            className="places-search"
          />
          {query.trim().length >= 2 && (
            <div className="friend-search-results">
              {searching ? (
                <p className="auth-sub" style={{ padding: 12 }}>searching…</p>
              ) : searchResults.length === 0 ? (
                <p className="auth-sub" style={{ padding: 12 }}>
                  no one new matches &quot;{query}&quot; — maybe they haven&apos;t signed up yet?
                </p>
              ) : (
                <ul className="friend-list">
                  {searchResults.map((p) => (
                    <li key={p.id} className="friend-list-item">
                      <Avatar profile={p} size={50} />
                      <div className="friend-list-meta">
                        <p className="friend-list-name">{p.display_name || "friend"}</p>
                      </div>
                      <button
                        onClick={() => addFriend(p.id)}
                        className="btn btn-primary friend-list-add"
                        disabled={adding.has(p.id)}
                      >
                        {adding.has(p.id) ? "adding…" : "+ add"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        {friends.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 30 }}>
            <p className="empty-emoji">👯</p>
            <p className="empty-title">no friends yet</p>
            <p className="empty-sub">share your link or search by name above to find your people</p>
          </div>
        ) : (
          <section style={{ marginTop: 40 }}>
            <p className="auth-label" style={{ marginTop: 0 }}>all friends</p>
            <ul className="friend-list">
              {friends.map((p) => (
                <li key={p.id} className="friend-list-item friend-list-item-current">
                  <Link href={`/u/${p.id}`} className="friend-list-link">
                    <Avatar profile={p} size={50} />
                    <div className="friend-list-meta">
                      <p className="friend-list-name">{p.display_name || "friend"}</p>
                      <span className="friend-list-sub">visit their scrapbook →</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}
