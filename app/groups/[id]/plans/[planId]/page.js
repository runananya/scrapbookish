"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { domToBlob } from "modern-screenshot";
import InvitationCard from "@/components/InvitationCard";
import { downloadIcs } from "@/lib/ics";

export default function PlanDetailPage() {
  return (
    <Suspense fallback={<main className="auth-wrap"><p className="auth-sub">loading the plan…</p></main>}>
      <PlanDetailPageInner />
    </Suspense>
  );
}

function PlanDetailPageInner() {
  const { id, planId } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoSendOnLoad = searchParams.get("send") === "auto";
  const autoSendRef = useRef(false);
  const [user, setUser] = useState(null);
  const [plan, setPlan] = useState(null);
  const [group, setGroup] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState({ text: "", type: "" });
  const [generating, setGenerating] = useState(false);
  const [generatingBg, setGeneratingBg] = useState(false);
  const [sending, setSending] = useState(false);
  const cardRef = useRef(null);

  useEffect(() => { load(); }, [planId]); // eslint-disable-line

  async function load() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace(`/login?next=/groups/${id}/plans/${planId}`);
      return;
    }
    setUser(user);

    const [{ data: p }, { data: g }, { data: att }] = await Promise.all([
      supabase.from("plans").select("*").eq("id", planId).maybeSingle(),
      supabase.from("groups").select("*").eq("id", id).maybeSingle(),
      supabase.from("plan_attendees").select("*").eq("plan_id", planId).order("invited_at"),
    ]);

    setPlan(p);
    setGroup(g);
    setAttendees(att || []);
    setLoading(false);
  }

  async function addAttendee(e) {
    e.preventDefault();
    if (!newEmail.trim() || adding) return;
    setAdding(true);
    setMsg({ text: "", type: "" });

    const supabase = createClient();
    const { error } = await supabase.from("plan_attendees").insert({
      plan_id: planId,
      email: newEmail.trim().toLowerCase(),
    });

    setAdding(false);
    if (error) {
      const text = error.code === "23505" ? "already invited!" : error.message;
      setMsg({ text, type: "error" });
      return;
    }
    setNewEmail("");
    load();
  }

  async function removeAttendee(attendeeId) {
    if (!confirm("uninvite this person?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("plan_attendees").delete().eq("id", attendeeId);
    if (error) {
      alert(error.message);
      return;
    }
    setAttendees((prev) => prev.filter((a) => a.id !== attendeeId));
  }

  async function renderInvitationBlob() {
    if (document.fonts?.ready) await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    // give cross-origin AI bg an extra moment if present
    if (plan.bg_image_url) await new Promise((r) => setTimeout(r, 250));
    return domToBlob(cardRef.current, {
      width: 1200,
      height: 800,
      scale: 2,
      type: "image/png",
    });
  }

  async function downloadInvitationPng() {
    if (!cardRef.current || generating) return;
    setGenerating(true);
    try {
      const blob = await renderInvitationBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invite-${plan.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`couldn't generate invitation: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  }

  async function generateAiBackground() {
    if (generatingBg) return;
    setGeneratingBg(true);
    setMsg({ text: "✨ asking the ai for a scrapbook background (10–20s)…", type: "success" });
    try {
      const res = await fetch(`/api/plans/${planId}/generate-bg`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hint: plan.title }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "generation failed");
      setPlan((p) => ({ ...p, bg_image_url: data.bg_image_url }));
      setMsg({ text: "✓ background ready! it's in the preview below.", type: "success" });
    } catch (err) {
      setMsg({ text: err.message, type: "error" });
    } finally {
      setGeneratingBg(false);
    }
  }

  async function sendInvitationEmails(skipConfirm = false) {
    if (sending || attendees.length === 0) return;
    if (!skipConfirm && !confirm(`send invitations to ${attendees.length} ${attendees.length === 1 ? "person" : "people"}?`)) return;
    setSending(true);
    setMsg({ text: "rendering the invitation…", type: "success" });
    try {
      const supabase = createClient();
      const blob = await renderInvitationBlob();
      const path = `${user.id}/invites/${planId}-${Date.now()}.png`;
      const { error: upErr } = await supabase.storage
        .from("place-photos")
        .upload(path, blob, { contentType: "image/png", cacheControl: "3600" });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("place-photos").getPublicUrl(path);

      setMsg({ text: "sending emails via resend…", type: "success" });
      const res = await fetch(`/api/plans/${planId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationUrl: publicUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "send failed");
      const summary = `sent ${data.sent}/${attendees.length}${data.failed ? ` (${data.failed} failed)` : ""}`;
      setMsg({ text: `✉️ ${summary}`, type: data.failed > 0 ? "error" : "success" });
    } catch (err) {
      setMsg({ text: err.message, type: "error" });
    } finally {
      setSending(false);
    }
  }

  // Auto-send invitations once data is loaded if arrived from the create form with ?send=auto
  useEffect(() => {
    if (loading || !plan || !user || autoSendRef.current) return;
    if (autoSendOnLoad && plan.created_by === user.id && attendees.length > 0) {
      autoSendRef.current = true;
      sendInvitationEmails(true);
    }
  }, [loading, plan, user, attendees, autoSendOnLoad]); // eslint-disable-line

  if (loading) return <main className="auth-wrap"><p className="auth-sub">loading the plan…</p></main>;
  if (!plan)   return (
    <main className="auth-wrap">
      <p className="auth-msg error">this plan doesn&apos;t exist</p>
      <p className="auth-switch"><Link href={`/groups/${id}`}>← back to group</Link></p>
    </main>
  );

  const isCreator = plan.created_by === user.id;
  const attendeeNames = attendees.map((a) => a.email.split("@")[0]);

  const dateObj = new Date(plan.starts_at);
  const niceDate = dateObj.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const niceTime = dateObj.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  return (
    <>
      <span className="tape tape-1" />
      <span className="doodle-heart doodle-heart-1">♡</span>

      <header className="nav">
        <Link href="/" className="logo">scrapbook<span className="logo-dot">.</span></Link>
        <nav className="nav-links">
          <Link href={`/groups/${id}`} className="sticker sticker-pink">← {group?.name || "group"}</Link>
        </nav>
      </header>

      <main className="scrap-main">
        <header className="scrap-header">
          <p className="kicker">a plan from</p>
          <p className="possessive">{group?.name}</p>
          <h2 className="scrap-section-title">{plan.title}</h2>
          <p className="scrap-subhead">{niceDate} · {niceTime}</p>
        </header>

        {(plan.location_name || plan.location_address) && (
          <p className="plan-location">
            📍 {plan.location_name}{plan.location_name && plan.location_address ? " · " : ""}{plan.location_address}
          </p>
        )}

        {plan.description && (
          <p className="plan-description">{plan.description}</p>
        )}

        <section className="plan-section">
          <h3 className="plan-section-title">who&apos;s invited ({attendees.length})</h3>

          <form onSubmit={addAttendee} className="invite-add-form">
            <input
              className="auth-input"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="friend@example.com"
            />
            <button type="submit" className="btn btn-primary" disabled={adding || !newEmail.trim()}>
              {adding ? "adding…" : "+ invite"}
            </button>
          </form>
          {msg.text && <p className={`auth-msg ${msg.type}`}>{msg.text}</p>}

          {attendees.length > 0 && (
            <ul className="attendees-list">
              {attendees.map((a) => (
                <li key={a.id} className="attendee-chip">
                  {a.email}
                  <span className={`rsvp-tag rsvp-${a.rsvp_status}`}>{a.rsvp_status}</span>
                  {isCreator && (
                    <button onClick={() => removeAttendee(a.id)} className="attendee-remove" title="uninvite">×</button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="plan-section">
          <h3 className="plan-section-title">the invitation</h3>
          <p className="plan-section-hint">
            download the invitation graphic + a .ics calendar file. share them via WhatsApp / Instagram / email yourself.
          </p>

          <div className="invite-preview">
            <InvitationCard
              ref={cardRef}
              plan={plan}
              groupName={group?.name || ""}
              attendeeNames={attendeeNames}
              bgImageUrl={plan.bg_image_url}
            />
          </div>

          <div className="invite-actions">
            <button onClick={generateAiBackground} className="btn btn-ghost" disabled={generatingBg || sending}>
              {generatingBg ? "✨ generating…" : (plan.bg_image_url ? "✨ regenerate ai background" : "✨ generate ai background")}
            </button>
            <button onClick={downloadInvitationPng} className="btn btn-primary" disabled={generating || sending}>
              {generating ? "rendering…" : "📥 download invitation"}
            </button>
            <button onClick={() => downloadIcs(plan)} className="btn btn-ghost" disabled={sending}>
              📅 download calendar (.ics)
            </button>
            {isCreator && (
              <button onClick={sendInvitationEmails} className="btn btn-primary" disabled={sending || attendees.length === 0}>
                {sending ? "sending…" : `✉️ send to ${attendees.length} ${attendees.length === 1 ? "friend" : "friends"}`}
              </button>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
