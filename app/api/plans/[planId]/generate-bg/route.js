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

  // 1. Build the Pollinations URL (the request triggers generation)
  let aiImageUrl;
  try {
    aiImageUrl = await generateBackground({ extraPromptHint });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  // 2. Fetch the generated image and re-upload to Supabase storage so the
  //    URL is stable and we don't depend on Pollinations forever
  let publicUrl;
  try {
    const imgRes = await fetch(aiImageUrl, { signal: AbortSignal.timeout(60_000) });
    if (!imgRes.ok) throw new Error(`pollinations fetch failed: ${imgRes.status}`);
    const arrayBuf = await imgRes.arrayBuffer();
    const path = `${user.id}/plan-bg-${planId}-${Date.now()}.png`;
    const { error: upErr } = await supabase
      .storage
      .from("place-photos")
      .upload(path, new Uint8Array(arrayBuf), {
        contentType: "image/png",
        cacheControl: "3600",
        upsert: false,
      });
    if (upErr) throw upErr;
    const { data: urlData } = supabase.storage.from("place-photos").getPublicUrl(path);
    publicUrl = urlData.publicUrl;
  } catch (err) {
    return NextResponse.json({ error: `image fetch/upload failed: ${err.message}` }, { status: 500 });
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
