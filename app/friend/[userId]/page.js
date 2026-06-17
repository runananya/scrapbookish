"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";

export default function FriendLinkPage() {
  const { userId } = useParams();
  const router = useRouter();
  const [state, setState] = useState("checking"); // checking | confirming | adding | added | already | error | self
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => { run(); }, [userId]); // eslint-disable-line

  async function run() {
    const supabase = createClient();
    const { data: { user: me } } = await supabase.auth.getUser();
    if (!me) {
      router.replace(`/login?next=/friend/${userId}`);
      return;
    }

    if (me.id === userId) {
      setState("self");
      return;
    }

    const { data: prof } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .eq("id", userId)
      .maybeSingle();

    if (!prof) {
      setState("error");
      setError("this person doesn't exist");
      return;
    }
    setProfile(prof);
    setState("confirming");
  }

  async function confirmAdd() {
    if (state === "adding") return;
    setState("adding");
    const supabase = createClient();
    const { data, error } = await supabase.rpc("create_friendship", {
      friend_user_id: userId,
    });
    if (error) {
      if (error.message.includes("already friends")) {
        setState("already");
        setTimeout(() => router.push(`/u/${userId}`), 1200);
      } else {
        setState("error");
        setError(error.message);
      }
      return;
    }
    setState("added");
    setTimeout(() => router.push(`/u/${userId}`), 1500);
  }

  return (
    <>
      <span className="tape tape-1" />
      <span className="doodle-heart doodle-heart-1">♡</span>

      <header className="nav">
        <Link href="/" className="logo">scrapbook<span className="logo-dot">.</span></Link>
        <nav className="nav-links">
          <Link href="/scrapbook" className="sticker sticker-pink">← back</Link>
        </nav>
      </header>

      <main className="auth-wrap" style={{ maxWidth: 460, textAlign: "center" }}>
        {state === "checking" && <p className="auth-sub">looking up…</p>}

        {state === "self" && (
          <>
            <p className="auth-msg">that&apos;s your own link! share it with friends.</p>
            <p className="auth-switch"><Link href="/scrapbook">← back to your scrapbook</Link></p>
          </>
        )}

        {state === "error" && (
          <>
            <p className="auth-msg error">{error || "something went wrong"}</p>
            <p className="auth-switch"><Link href="/scrapbook">← back to your scrapbook</Link></p>
          </>
        )}

        {state === "confirming" && profile && (
          <>
            <div style={{ marginBottom: 18 }}>
              <Avatar profile={profile} size={120} />
            </div>
            <p className="kicker">add</p>
            <p className="possessive" style={{ fontSize: 56, marginBottom: 8 }}>
              {profile.display_name || "this person"}
            </p>
            <p className="auth-sub" style={{ marginBottom: 28 }}>
              as a friend? you&apos;ll see each other&apos;s scrapbooks, recommend places, plan things.
            </p>
            <div className="auth-row">
              <button onClick={confirmAdd} className="btn btn-primary">
                ✨ yes, add friend
              </button>
            </div>
            <p className="auth-switch" style={{ marginTop: 14 }}>
              <Link href="/scrapbook">cancel</Link>
            </p>
          </>
        )}

        {state === "adding" && (
          <>
            <div style={{ marginBottom: 18 }}><Avatar profile={profile} size={120} /></div>
            <p className="auth-sub">making friends…</p>
          </>
        )}

        {state === "added" && (
          <>
            <div style={{ marginBottom: 18 }}><Avatar profile={profile} size={120} /></div>
            <p className="possessive" style={{ color: "var(--sage)", fontSize: 44 }}>
              friends! ✨
            </p>
            <p className="auth-sub">taking you to {profile.display_name}&apos;s scrapbook…</p>
          </>
        )}

        {state === "already" && (
          <>
            <div style={{ marginBottom: 18 }}><Avatar profile={profile} size={120} /></div>
            <p className="auth-sub">you&apos;re already friends! ♡ taking you there…</p>
          </>
        )}
      </main>
    </>
  );
}
