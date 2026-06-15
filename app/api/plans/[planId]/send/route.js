import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { buildIcs } from "@/lib/ics";

export async function POST(req, { params }) {
  const { planId } = await params;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "RESEND_API_KEY is not set in .env.local" },
      { status: 500 }
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const { invitationUrl } = await req.json().catch(() => ({}));
  if (!invitationUrl) {
    return NextResponse.json({ error: "invitationUrl is required" }, { status: 400 });
  }

  // Load plan + group + attendees
  const { data: plan } = await supabase
    .from("plans")
    .select("*")
    .eq("id", planId)
    .maybeSingle();
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

  // Fetch the invitation PNG once and base64 it
  let pngBase64;
  try {
    const imgRes = await fetch(invitationUrl);
    if (!imgRes.ok) throw new Error(`fetch failed: ${imgRes.status}`);
    const buf = Buffer.from(await imgRes.arrayBuffer());
    pngBase64 = buf.toString("base64");
  } catch (err) {
    return NextResponse.json({ error: `couldn't fetch invitation: ${err.message}` }, { status: 500 });
  }

  // Generate the .ics
  const ics = buildIcs(plan);

  // Send via Resend
  const resend = new Resend(apiKey);
  const senderName = creatorProfile?.display_name || "your friend";
  const niceDate = new Date(plan.starts_at).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
  const niceTime = new Date(plan.starts_at).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit",
  });

  const results = await Promise.allSettled(
    attendees.map((a) =>
      resend.emails.send({
        from: "Scrapbook <onboarding@resend.dev>",
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
    .map((r) => (r.status === "rejected" ? r.reason?.message : r.value?.error?.message))
    .filter(Boolean);

  return NextResponse.json({ sent, failed, errors });
}

function buildEmailHtml({ plan, group, senderName, niceDate, niceTime }) {
  const loc = [plan.location_name, plan.location_address].filter(Boolean).join(" · ");
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#fde2cf;font-family:Georgia,serif;color:#2a2a2a;">
  <div style="max-width:600px;margin:40px auto;padding:32px 24px;background:#fffdf7;border-radius:8px;box-shadow:0 14px 30px rgba(0,0,0,0.15);">
    <p style="font-size:18px;color:#6b9080;margin:0 0 6px;">${senderName} is inviting you to</p>
    <h1 style="font-size:36px;color:#2a2a2a;margin:0 0 18px;font-family:'Permanent Marker','Brush Script MT',cursive;">${escapeHtml(plan.title)}</h1>
    <p style="margin:6px 0;font-size:17px;"><strong style="color:#e07856;">when</strong> · ${escapeHtml(niceDate)}, ${escapeHtml(niceTime)}</p>
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
