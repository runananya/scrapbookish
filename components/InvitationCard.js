"use client";

import { forwardRef } from "react";

// Beautiful scrapbook-style invitation card. Rendered off-screen at fixed
// dimensions and snapshotted to PNG. Landscape (1200×800).

const InvitationCard = forwardRef(function InvitationCard(
  { plan, groupName, attendeeNames = [], bgImageUrl = null },
  ref
) {
  const date = new Date(plan.starts_at);
  const dayNum = date.toLocaleDateString("en-US", { day: "numeric" });
  const monthShort = date.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
  const timeStr = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const year = date.getFullYear();

  const titleLetters = plan.title.split("");

  return (
    <div
      ref={ref}
      className="invite-card"
      style={{ width: 1200, height: 800 }}
    >
      {bgImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={bgImageUrl} alt="" className="invite-bg-ai" crossOrigin="anonymous" />
      ) : (
        <>
          <div className="invite-paper" />
          <div className="invite-paper-wash" />
        </>
      )}

      {/* decorations layer */}
      <svg className="invite-doodles" viewBox="0 0 1200 800" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <g fill="#e07856" stroke="#b23c2a" strokeWidth="2" strokeLinejoin="round">
          <path d="M 90 110 l 8 18 l 20 2 l -15 13 l 5 20 l -18 -11 l -18 11 l 5 -20 l -15 -13 l 20 -2 z" transform="rotate(-15 85 125)" />
          <path d="M 1100 600 l 8 18 l 20 2 l -15 13 l 5 20 l -18 -11 l -18 11 l 5 -20 l -15 -13 l 20 -2 z" transform="rotate(20 1100 614)" fill="#ffd966" />
        </g>
        <g>
          <path d="M 1080 130 c -8 -16 -32 -12 -32 4 c 0 16 32 32 32 32 c 0 0 32 -16 32 -32 c 0 -16 -24 -20 -32 -4 z" fill="#e07856" stroke="#b23c2a" strokeWidth="2" transform="rotate(14 1080 150)" />
          <path d="M 130 660 c -6 -12 -24 -9 -24 3 c 0 12 24 24 24 24 c 0 0 24 -12 24 -24 c 0 -12 -18 -15 -24 -3 z" fill="#f7c5cc" stroke="#b23c2a" strokeWidth="1.5" transform="rotate(-12 130 678)" />
        </g>
        <path d="M 460 730 q 20 -10 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0" fill="none" stroke="#e07856" strokeWidth="3" strokeLinecap="round" />
      </svg>

      {/* date polaroid — bottom-right */}
      <div className="invite-date-polaroid">
        <span className="invite-date-tape" />
        <div className="invite-date-month">{monthShort}</div>
        <div className="invite-date-day">{dayNum}</div>
        <div className="invite-date-year">&apos;{String(year).slice(2)}</div>
      </div>

      {/* "you're invited" handwritten — top-left */}
      <div className="invite-header">
        <p className="invite-kicker">you&apos;re invited to</p>
      </div>

      {/* big ransom title */}
      <div className="invite-title-ransom">
        {titleLetters.map((letter, i) => (
          <span key={i} className={`ransom-letter invite-ransom-letter ransom-${i % 9}`}>
            {letter === " " ? " " : letter}
          </span>
        ))}
      </div>

      {/* details — date, time, location */}
      <div className="invite-details">
        <p className="invite-detail-line">
          <span className="invite-detail-label">when</span>
          <span className="invite-detail-value">{dayName}, {timeStr}</span>
        </p>
        {(plan.location_name || plan.location_address) && (
          <p className="invite-detail-line">
            <span className="invite-detail-label">where</span>
            <span className="invite-detail-value">
              {plan.location_name}{plan.location_name && plan.location_address ? " · " : ""}{plan.location_address}
            </span>
          </p>
        )}
        <p className="invite-detail-line">
          <span className="invite-detail-label">from</span>
          <span className="invite-detail-value">{groupName} ♡</span>
        </p>
      </div>

      {/* attendee names — handwritten list */}
      {attendeeNames.length > 0 && (
        <div className="invite-attendees">
          <p className="invite-attendees-label">for</p>
          <p className="invite-attendees-names">
            {attendeeNames.slice(0, 6).join(" · ")}
            {attendeeNames.length > 6 && ` + ${attendeeNames.length - 6} more`}
          </p>
        </div>
      )}

      {/* vintage stamp top-right */}
      <div className="invite-stamp">
        <span className="invite-stamp-heart">♥</span>
        <span className="invite-stamp-label">SCRAPBOOK</span>
        <span className="invite-stamp-year">{year}</span>
      </div>

      {/* wax seal bottom-left */}
      <div className="invite-wax-seal">♥</div>

      {/* washi tape strips */}
      <span className="invite-tape invite-tape-1" />
      <span className="invite-tape invite-tape-2" />
    </div>
  );
});

export default InvitationCard;
