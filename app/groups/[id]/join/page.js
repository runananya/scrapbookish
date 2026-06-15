"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function JoinGroupPage() {
  const { id } = useParams();
  const router = useRouter();
  const [state, setState] = useState("checking"); // checking | joining | joined | error
  const [error, setError] = useState("");
  const [groupName, setGroupName] = useState("");

  useEffect(() => { run(); }, [id]); // eslint-disable-line

  async function run() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace(`/login?next=/groups/${id}/join`);
      return;
    }

    const { data: g } = await supabase
      .from("groups")
      .select("name")
      .eq("id", id)
      .maybeSingle();
    if (!g) {
      setState("error");
      setError("that group doesn't exist");
      return;
    }
    setGroupName(g.name);

    // already a member?
    const { data: existing } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("group_id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (existing) {
      setState("joined");
      router.replace(`/groups/${id}`);
      return;
    }

    setState("joining");
    const { error: insErr } = await supabase
      .from("group_members")
      .insert({ group_id: id, user_id: user.id, role: "member" });
    if (insErr) {
      setState("error");
      setError(insErr.message);
      return;
    }
    setState("joined");
    router.replace(`/groups/${id}`);
  }

  return (
    <main className="auth-wrap">
      {state === "checking" && <p className="auth-sub">checking the invite…</p>}
      {state === "joining" && <p className="auth-sub">joining {groupName || "the group"}…</p>}
      {state === "joined"  && <p className="auth-sub">welcome to {groupName}! ✨</p>}
      {state === "error"   && (
        <>
          <p className="auth-msg error">{error}</p>
          <p className="auth-switch"><Link href="/groups">← back to groups</Link></p>
        </>
      )}
    </main>
  );
}
