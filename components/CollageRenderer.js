"use client";

import { forwardRef } from "react";

// HTML/CSS collage layout. Rendered off-screen and snapshotted to PNG.
// Dimensions are FIXED (900×900) so it produces a consistent image at any
// viewport size. All sizes in px (no rem) so the snapshot is deterministic.

const CANVAS = 900;
const TAPE_COLORS = ["#f7c5cc", "#ffd966", "#b8dbc4", "#ffb59a"];

const CollageRenderer = forwardRef(function CollageRenderer({ photos, label }, ref) {
  const layouts = layoutFor(photos.length);

  return (
    <div
      ref={ref}
      className="collage-render"
      style={{ width: CANVAS, height: CANVAS }}
    >
      {/* paper background */}
      <div className="collage-paper" />
      <div className="collage-paper-wash" />

      {/* hand-drawn doodle decorations */}
      <Doodles />

      {/* photos as polaroids */}
      {photos.map((src, i) => (
        <Polaroid
          key={`${i}-${src}`}
          src={src}
          slot={layouts[i]}
          tapeColor={TAPE_COLORS[i % TAPE_COLORS.length]}
        />
      ))}

      {/* handwritten label at the bottom */}
      {label && (
        <div className="collage-label">
          <span>~ {label} ~</span>
        </div>
      )}
    </div>
  );
});

function Polaroid({ src, slot, tapeColor }) {
  const { left, top, w, h, rot } = slot;
  return (
    <div
      className="collage-polaroid"
      style={{
        left, top,
        width: w + 36,
        height: h + 78,
        transform: `rotate(${rot}deg)`,
      }}
    >
      <div
        className="collage-tape"
        style={{
          background: tapeColor,
          transform: `translateX(-50%) rotate(${-rot - 4}deg)`,
        }}
      />
      <div
        className="collage-photo"
        style={{
          backgroundImage: `url("${src}")`,
          width: w,
          height: h,
        }}
      />
    </div>
  );
}

function Doodles() {
  return (
    <svg
      className="collage-doodles"
      viewBox="0 0 900 900"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* scattered stars */}
      <g fill="#e07856" stroke="#b23c2a" strokeWidth="2" strokeLinejoin="round">
        <path d="M 90 80 l 8 18 l 20 2 l -15 13 l 5 20 l -18 -11 l -18 11 l 5 -20 l -15 -13 l 20 -2 z" transform="rotate(-15 85 95)" />
        <path d="M 800 130 l 6 14 l 16 1 l -12 10 l 4 15 l -14 -8 l -14 8 l 4 -15 l -12 -10 l 16 -1 z" transform="rotate(20 800 140)" fill="#ffd966" />
        <path d="M 760 800 l 7 16 l 18 2 l -13 12 l 4 18 l -16 -10 l -16 10 l 4 -18 l -13 -12 l 18 -2 z" transform="rotate(-10 760 815)" fill="#6b9080" />
      </g>

      {/* hearts */}
      <g>
        <path
          d="M 130 760 c -8 -16 -32 -12 -32 4 c 0 16 32 32 32 32 c 0 0 32 -16 32 -32 c 0 -16 -24 -20 -32 -4 z"
          fill="#e07856"
          stroke="#b23c2a"
          strokeWidth="2"
          transform="rotate(-12 130 780)"
        />
        <path
          d="M 820 460 c -6 -12 -24 -9 -24 3 c 0 12 24 24 24 24 c 0 0 24 -12 24 -24 c 0 -12 -18 -15 -24 -3 z"
          fill="#f7c5cc"
          stroke="#b23c2a"
          strokeWidth="1.5"
          transform="rotate(18 820 475)"
        />
      </g>

      {/* sparkle dots */}
      <g fill="#b23c2a">
        <circle cx="60" cy="450" r="4" />
        <circle cx="50" cy="465" r="2.5" />
        <circle cx="76" cy="455" r="2.5" />
        <circle cx="860" cy="300" r="4" />
        <circle cx="850" cy="318" r="2.5" />
        <circle cx="876" cy="305" r="2.5" />
      </g>

      {/* squiggly underline */}
      <path
        d="M 320 870 q 20 -10 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0"
        fill="none"
        stroke="#e07856"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Hand-tuned positions per photo count
function layoutFor(count) {
  if (count === 1) {
    return [{ left: 170, top: 170, w: 560, h: 560, rot: -3 }];
  }
  if (count === 2) {
    return [
      { left: 100, top: 220, w: 360, h: 380, rot: -9 },
      { left: 460, top: 280, w: 360, h: 380, rot: 7 },
    ];
  }
  if (count === 3) {
    return [
      { left: 100, top: 150, w: 300, h: 320, rot: -11 },
      { left: 520, top: 170, w: 300, h: 320, rot: 8 },
      { left: 300, top: 470, w: 320, h: 320, rot: -2 },
    ];
  }
  return [
    { left: 100, top: 110, w: 280, h: 280, rot: -10 },
    { left: 520, top: 130, w: 280, h: 280, rot: 7 },
    { left: 110, top: 480, w: 280, h: 280, rot: 6 },
    { left: 520, top: 500, w: 280, h: 280, rot: -8 },
  ];
}

export default CollageRenderer;
