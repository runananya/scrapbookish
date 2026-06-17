import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { buildIcs } from "@/lib/ics";

// Hint Vercel to allow more time. Pro plan supports up to 60s; hobby caps at 10s.
export const maxDuration = 60;

// Defensively extract a Resend API key from whatever was pasted into the env var.
// Handles: plain key, "RESEND_API_KEY=re_xxx" lines accidentally pasted as the
// value, multi-line pastes, concatenated duplicates, surrounding quotes.
function cleanResendKey(raw) {
  if (!raw) return null;
  const s = String(raw);
  // Most reliable: just grab the first re_... token
  const m = s.match(/re_[A-Za-z0-9_-]{20,}/);
  return m ? m[0] : s.trim().replace(/^["']|["']$/g, "");
}

export async function POST(req, { params }) {
  try {
    const { planId } = await params;
    const apiKey = cleanResendKey(process.env.RESEND_API_KEY);
    if (!apiKey) {
      return NextResponse.json(
        { error: "RESEND_API_KEY is not set on the server" },
        { status: 500 }
      );
    }

    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "not authenticated" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { invitationBase64, invitationUrl } = body;

    if (!invitationBase64 && !invitationUrl) {
      return NextResponse.json({ error: "invitationBase64 or invitationUrl is required" }, { status: 400 });
    }

    // Quick size check — Resend rejects requests over ~10MB total
    if (invitationBase64 && invitationBase64.length > 6_000_000) {
      return NextResponse.json({
        error: `invitation image is too large (${Math.round(invitationBase64.length / 1024)}KB). Try simpler decorations.`
      }, { status: 413 });
    }

    // Load plan + group + attendees
    const { data: plan, error: planErr } = await supabase
      .from("plans")
      .select("*")
      .eq("id", planId)
      .maybeSingle();
    if (planErr) {
      return NextResponse.json({ error: `plan lookup failed: ${planErr.message}` }, { status: 500 });
    }
    if (!plan) return NextResponse.json({ error: "plan not found" }, { status: 404 });

    if (plan.created_by !== user.id) {
      return NextResponse.json({ error: "only the plan creator can send invites" }, { status: 403 });
    }

    const [{ data: group }, { data: attendees }, { data: creatorProfile }] = await Promise.all([
      supabase.from("groups").select("name").eq("id", plan.group_id).maybeSingle(),
      supabase.from("plan_attendees").select("email").eq("plan_id", planId),
      supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    ]);

    if (!attendees || attendees.length === 0) {
      return NextResponse.json({ error: "invite some friends first" }, { status: 400 });
    }

    // Get the PNG as base64 — either passed in directly (preferred) or fetched
    let pngBase64;
    try {
      if (invitationBase64) {
        pngBase64 = invitationBase64;
      } else {
        const imgRes = await fetch(invitationUrl, { signal: AbortSignal.timeout(8000) });
        if (!imgRes.ok) throw new Error(`fetch failed: ${imgRes.status}`);
        const buf = Buffer.from(await imgRes.arrayBuffer());
        pngBase64 = buf.toString("base64");
      }
    } catch (err) {
      return NextResponse.json({ error: `couldn't load invitation image: ${err.message}` }, { status: 500 });
    }

    // Generate the .ics — safe to call even with edge cases
    let ics;
    try {
      ics = buildIcs(plan);
    } catch (err) {
      return NextResponse.json({ error: `couldn't build calendar file: ${err.message}` }, { status: 500 });
    }

    const resend = new Resend(apiKey);
    const fromAddress = process.env.RESEND_FROM_EMAIL || "Scrapbook <onboarding@resend.dev>";
    const senderName = creatorProfile?.display_name || "your friend";

    let niceDate, niceTime;
    try {
      const d = new Date(plan.starts_at);
      niceDate = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
      niceTime = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    } catch {
      niceDate = "the day of the plan";
      niceTime = "";
    }

    const results = await Promise.allSettled(
      attendees.map((a) =>
        resend.emails.send({
          from: fromAddress,
          to: a.email,
          subject: `you're invited: ${plan.title}`,
          html: buildEmailHtml({ plan, group, senderName, niceDate, niceTime }),
          attachments: [
            { filename: "invitation.png", content: pngBase64 },
            { filename: "event.ics", content: ics, contentType: "text/calendar" },
          ],
        })
      )
    );

    const sent = results.filter((r) => r.status === "fulfilled" && !r.value?.error).length;
    const failed = results.length - sent;
    const errors = results
      .filter((r) => r.status === "rejected" || r.value?.error)
      .map((r) => (r.status === "rejected" ? String(r.reason?.message || r.reason) : String(r.value?.error?.message || r.value?.error)))
      .filter(Boolean);

    // Log the result so it shows up in Vercel function logs
    console.log("[send-invitation] result", { planId, sent, failed, errors });

    return NextResponse.json({ sent, failed, errors });
  } catch (err) {
    // Last-ditch catch — turn any unhandled exception into a useful JSON response
    console.error("[send-invitation] unhandled error", err);
    return NextResponse.json(
      { error: `unhandled: ${err?.message || String(err)}` },
      { status: 500 }
    );
  }
}

function buildEmailHtml({ plan, group, senderName, niceDate, niceTime }) {
  const loc = [plan.location_name, plan.location_address].filter(Boolean).join(" · ");
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#fde2cf;font-family:Georgia,serif;color:#2a2a2a;">
  <div style="max-width:600px;margin:40px auto;padding:32px 24px;background:#fffdf7;border-radius:8px;box-shadow:0 14px 30px rgba(0,0,0,0.15);">
    <p style="font-size:18px;color:#6b9080;margin:0 0 6px;">${escapeHtml(senderName)} is inviting you to</p>
    <h1 style="font-size:36px;color:#2a2a2a;margin:0 0 18px;font-family:'Permanent Marker','Brush Script MT',cursive;">${escapeHtml(plan.title)}</h1>
    <p style="margin:6px 0;font-size:17px;"><strong style="color:#e07856;">when</strong> · ${escapeHtml(niceDate)}${niceTime ? `, ${escapeHtml(niceTime)}` : ""}</p>
    ${loc ? `<p style="margin:6px 0;font-size:17px;"><strong style="color:#e07856;">where</strong> · ${escapeHtml(loc)}</p>` : ""}
    <p style="margin:6px 0;font-size:17px;"><strong style="color:#e07856;">from</strong> · ${escapeHtml(group?.name || "the group")}</p>
    ${plan.description ? `<p style="margin:18px 0 0;font-size:16px;line-height:1.5;color:#5a4a3a;">${escapeHtml(plan.description)}</p>` : ""}
    <p style="margin:24px 0 6px;font-size:14px;color:#5a4a3a;">📎 the attached <strong>event.ics</strong> file adds this to your calendar in one tap.</p>
    <p style="margin:6px 0 0;font-size:14px;color:#5a4a3a;">🖼️ the attached <strong>invitation.png</strong> is your scrapbook invite — feel free to save or share.</p>
    <hr style="border:none;border-top:1px dashed #c9a87b;margin:28px 0 12px;">
    <p style="margin:0;font-size:13px;color:#8a7259;">made with washi tape &amp; love · scrapbook</p>
  </div>
</body></html>`;
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}
