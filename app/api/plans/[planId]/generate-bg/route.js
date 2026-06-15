import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateBackground } from "@/lib/ai-background";

export async function POST(req, { params }) {
  const { planId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  // Verify the user can see this plan (RLS will also enforce; this gives a clean error)
  const { data: plan, error: planErr } = await supabase
    .from("plans")
    .select("id, title, group_id")
    .eq("id", planId)
    .maybeSingle();
  if (planErr || !plan) {
    return NextResponse.json({ error: "plan not found" }, { status: 404 });
  }

  let body = {};
  try { body = await req.json(); } catch {}
  const extraPromptHint = (body.hint || "").toString().slice(0, 200) || null;

  // 1. Call Gemini to generate the image (returns base64)
  let aiImage;
  try {
    aiImage = await generateBackground({ extraPromptHint });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  // 2. Upload to Supabase storage so the URL is stable
  let publicUrl;
  try {
    const buffer = Buffer.from(aiImage.base64, "base64");
    const ext = aiImage.contentType.includes("jpeg") ? "jpg" : "png";
    const path = `${user.id}/plan-bg-${planId}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase
      .storage
      .from("place-photos")
      .upload(path, buffer, {
        contentType: aiImage.contentType,
        cacheControl: "3600",
        upsert: false,
      });
    if (upErr) throw upErr;
    const { data: urlData } = supabase.storage.from("place-photos").getPublicUrl(path);
    publicUrl = urlData.publicUrl;
  } catch (err) {
    return NextResponse.json({ error: `storage upload failed: ${err.message}` }, { status: 500 });
  }

  // 3. Save URL onto the plan
  const { error: updErr } = await supabase
    .from("plans")
    .update({ bg_image_url: publicUrl })
    .eq("id", planId);
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({ bg_image_url: publicUrl });
}
