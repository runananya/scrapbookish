// Generate a scrapbook-style background via Google Gemini (Nano Banana).
// Model: gemini-2.5-flash-image. Free tier through Google AI Studio.

const MODEL = "gemini-2.5-flash-image";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const PROMPT = (extra) =>
  `Create a vintage scrapbook page background texture image. ` +
  `Warm cream and peach paper with soft watercolor washes in coral and sage. ` +
  `Hand-torn paper edges, tiny pressed flowers and decorative washi tape strips at the corners, ` +
  `decorative postage stamps, hand-drawn doodle stars and hearts scattered. ` +
  `Flat-lay top-down view, soft natural lighting, scrapbook aesthetic. ` +
  `Absolutely no text, no letters, no words, no people, no faces.` +
  (extra ? ` Themed around: ${extra}.` : "");

function cleanKey(raw) {
  if (!raw) return null;
  const s = String(raw);
  // Strip any accidental "GEMINI_API_KEY=" prefix and quotes; trust the first
  // non-whitespace token if it's a long alphanumeric string
  const m = s.match(/[A-Za-z0-9_.\-]{20,}/);
  return m ? m[0] : s.trim().replace(/^["']|["']$/g, "");
}

export async function generateBackground({ extraPromptHint } = {}) {
  const apiKey = cleanKey(process.env.GEMINI_API_KEY);
  if (!apiKey || apiKey.includes("paste_your")) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const res = await fetch(`${ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: PROMPT(extraPromptHint) }] }],
      generationConfig: {
        responseModalities: ["IMAGE"],
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((p) => p.inlineData?.data);
  if (!imagePart) {
    throw new Error("Gemini returned no image data");
  }

  return {
    base64: imagePart.inlineData.data,
    contentType: imagePart.inlineData.mimeType || "image/png",
  };
}
