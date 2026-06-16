"use client";

const PALETTE = ["#e07856", "#6b9080", "#f7c5cc", "#ffd966", "#b23c2a", "#8b5a3c"];

function colorForName(name) {
  if (!name) return PALETTE[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

export default function Avatar({ profile, size = 42, className = "" }) {
  const name = profile?.display_name || profile?.name || "?";
  const initial = (name[0] || "?").toUpperCase();
  const url = profile?.avatar_url;

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        title={name}
        className={`avatar ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.45 }}
      />
    );
  }

  return (
    <div
      className={`avatar avatar-fallback ${className}`}
      title={name}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: colorForName(name),
      }}
    >
      {initial}
    </div>
  );
}
