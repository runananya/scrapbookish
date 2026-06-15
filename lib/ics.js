// Generate an RFC 5545 .ics calendar event for a plan.
// No external dependency — the format is just plain text.

export function buildIcs(plan) {
  const start = toIcsDate(new Date(plan.starts_at));
  const end = toIcsDate(plan.ends_at ? new Date(plan.ends_at) : addHours(new Date(plan.starts_at), 2));
  const stamp = toIcsDate(new Date());
  const uid = `${plan.id}@scrapbook.app`;

  const locParts = [plan.location_name, plan.location_address].filter(Boolean);
  const location = escapeIcsText(locParts.join(", "));
  const summary = escapeIcsText(plan.title);
  const description = escapeIcsText(plan.description || "");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Scrapbook//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${summary}`,
    description && `DESCRIPTION:${description}`,
    location && `LOCATION:${location}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}

function toIcsDate(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function addHours(d, h) {
  return new Date(d.getTime() + h * 60 * 60 * 1000);
}

function escapeIcsText(text) {
  return String(text || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export function downloadIcs(plan) {
  const ics = buildIcs(plan);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${plan.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
