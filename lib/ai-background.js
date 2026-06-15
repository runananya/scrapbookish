// Generate a scrapbook-style background via Pollinations.ai.
// Truly free, no API key, no signup, no billing. Uses FLUX under the hood.
// Caveat: community-funded service, no uptime SLA.

const POLLINATIONS_BASE = "https://image.pollinations.ai/prompt/";

const PROMPT = (extra) =>
  `vintage scrapbook page background texture, warm cream peach paper, ` +
  `soft watercolor washes in coral and sage, hand-torn paper edges, ` +
  `tiny pressed flowers and decorative washi tape strips at corners, ` +
  `decorative postage stamps, hand-drawn doodle stars and hearts scattered, ` +
  `flat-lay top-down view, soft natural lighting, scrapbook aesthetic, ` +
  `no text, no letters, no words, no people, no faces` +
  (extra ? `, themed around ${extra}` : "");

export async function generateBackground({ extraPromptHint } = {}) {
  const prompt = PROMPT(extraPromptHint);
  const seed = Math.floor(Math.random() * 1_000_000);
  const params = new URLSearchParams({
    width: "1200",
    height: "800",
    model: "flux",
    nologo: "true",
    seed: String(seed),
  });
  return `${POLLINATIONS_BASE}${encodeURIComponent(prompt)}?${params.toString()}`;
}
