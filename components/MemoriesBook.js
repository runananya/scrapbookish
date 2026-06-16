"use client";

import { Suspense, useState, useMemo, useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { useSpring, animated } from "@react-spring/three";
import * as THREE from "three";
import { createClient } from "@/lib/supabase/client";

const EMOJI_PALETTE = ["♥", "♡", "★", "✦", "✨", "🌸", "🌟", "🌷", "💕", "💫", "🎀", "🌙"];
let _decoIdCounter = 0;
const newDecoId = () => `bd${Date.now()}-${_decoIdCounter++}`;

// Convert 2D-stored decorations to 3D world coords on a page
function decorationToWorld(dec) {
  return {
    x: (dec.x / 100 - 0.5) * PAGE_W,
    y: -(dec.y / 100 - 0.5) * PAGE_H,
    size: dec.size / 200, // px → world units (calibrated so 120px ≈ 0.6 world)
    rotation: -((dec.rotation || 0) * Math.PI) / 180, // CSS clockwise → Three CCW
  };
}

const PAGE_W = 3.6;
const PAGE_H = 4.8;
const PAGE_GAP = 0.03; // separation between pages — must be > any internal z offset

// Singleton notebook-paper texture: light blue with horizontal rules + red margin
let _notebookTexture = null;
function getNotebookTexture() {
  if (typeof document === "undefined") return null;
  if (_notebookTexture) return _notebookTexture;

  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");

  // soft blue paper
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, "#eef4fa");
  grad.addColorStop(1, "#dde9f3");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // horizontal rule lines
  ctx.strokeStyle = "#a8c5e0";
  ctx.lineWidth = 1.6;
  const lineCount = 22;
  const topPad = 80;
  const bottomPad = 60;
  const usable = canvas.height - topPad - bottomPad;
  const spacing = usable / lineCount;
  for (let i = 0; i <= lineCount; i++) {
    const y = topPad + i * spacing;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // red margin line down the left
  ctx.strokeStyle = "#e07856";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(80, 0);
  ctx.lineTo(80, canvas.height);
  ctx.stroke();

  // three subtle hole-punches on the left edge
  ctx.fillStyle = "#fde2cf";
  ctx.strokeStyle = "rgba(0,0,0,0.08)";
  ctx.lineWidth = 1;
  for (let h = 0; h < 3; h++) {
    const cy = canvas.height * (0.18 + h * 0.32);
    ctx.beginPath();
    ctx.arc(28, cy, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  _notebookTexture = tex;
  return tex;
}

export default function MemoriesBook({ places: initialPlaces, editable = false }) {
  // pageIndex: -1 = cover showing, 0..N-1 = showing places[pageIndex]
  const [pageIndex, setPageIndex] = useState(-1);
  const [places, setPlaces] = useState(initialPlaces);
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const originalDecorationsRef = useRef({}); // placeId → original decorations (for cancel)

  useEffect(() => { setPlaces(initialPlaces); }, [initialPlaces]);

  const total = places.length;
  const canNext = pageIndex < total - 1 && !editing;
  const canPrev = pageIndex > -1 && !editing;
  const canEdit = editable && pageIndex >= 0;
  const currentPlace = pageIndex >= 0 ? places[pageIndex] : null;

  function updateCurrentDecorations(updater) {
    if (pageIndex < 0) return;
    setPlaces((arr) => arr.map((p, i) =>
      i === pageIndex ? { ...p, decorations: updater(p.decorations || []) } : p
    ));
    setDirty(true);
  }

  function startEditing() {
    if (!canEdit) return;
    originalDecorationsRef.current[currentPlace.id] = currentPlace.decorations || [];
    setEditing(true);
    setDirty(false);
  }

  function cancelEditing() {
    if (pageIndex < 0) { setEditing(false); return; }
    const placeId = currentPlace.id;
    const original = originalDecorationsRef.current[placeId];
    if (original !== undefined) {
      setPlaces((arr) => arr.map((p, i) => i === pageIndex ? { ...p, decorations: original } : p));
    }
    setEditing(false);
    setDirty(false);
  }

  async function saveEditing() {
    if (pageIndex < 0) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("places")
      .update({ decorations: currentPlace.decorations || [] })
      .eq("id", currentPlace.id);
    setSaving(false);
    if (error) {
      alert(error.message);
      return;
    }
    delete originalDecorationsRef.current[currentPlace.id];
    setEditing(false);
    setDirty(false);
  }

  function addEmojiSticker(emoji) {
    updateCurrentDecorations((decs) => [
      ...decs,
      {
        id: newDecoId(),
        type: "sticker",
        emoji,
        x: 50,
        y: 50,
        rotation: Math.floor(Math.random() * 30) - 15,
        size: 56,
      },
    ]);
  }

  function addText() {
    const content = window.prompt("what should it say?", "✨ a memory ✨");
    if (!content || !content.trim()) return;
    updateCurrentDecorations((decs) => [
      ...decs,
      {
        id: newDecoId(),
        type: "text",
        content: content.trim(),
        x: 50,
        y: 50,
        rotation: Math.floor(Math.random() * 16) - 8,
        size: 32,
        color: "#e07856",
      },
    ]);
  }

  function moveDecoration(decId, x, y) {
    updateCurrentDecorations((decs) => decs.map((d) => d.id === decId ? { ...d, x, y } : d));
  }
  function removeDecoration(decId) {
    updateCurrentDecorations((decs) => decs.filter((d) => d.id !== decId));
  }

  return (
    <div className="book-stage">
      <Canvas
        camera={{ position: [0, 0, 7], fov: 42 }}
        gl={{ antialias: true, alpha: true, toneMapping: THREE.NoToneMapping }}
        dpr={[1, 2]}
        flat
        style={{ width: "100%", height: "100%", display: "block" }}
      >
        <ambientLight intensity={1.1} />
        <directionalLight position={[3, 4, 6]} intensity={0.5} />
        <directionalLight position={[-3, -2, 4]} intensity={0.2} />

        <Suspense fallback={<DebugCube />}>
          {/* offset so the closed book is centered horizontally in the canvas */}
          <group scale={1.15} position={[-PAGE_W / 2, 0, 0]}>
            <Book
              places={places}
              pageIndex={pageIndex}
              editing={editing}
              onTurnRight={() => canNext && setPageIndex(pageIndex + 1)}
              onTurnLeft={() => canPrev && setPageIndex(pageIndex - 1)}
              onMoveDecoration={moveDecoration}
              onRemoveDecoration={removeDecoration}
            />
          </group>
        </Suspense>
      </Canvas>

      {/* UI overlay */}
      {!editing ? (
        <div className="book-controls">
          <button onClick={() => canPrev && setPageIndex(pageIndex - 1)} disabled={!canPrev}>
            ← prev
          </button>
          <span className="book-counter">
            {pageIndex === -1 ? "cover" : `memory ${pageIndex + 1} / ${total}`}
          </span>
          <button onClick={() => canNext && setPageIndex(pageIndex + 1)} disabled={!canNext}>
            next →
          </button>
          {canEdit && (
            <button onClick={startEditing} className="book-edit-btn">
              ✏️ decorate
            </button>
          )}
        </div>
      ) : (
        <div className="book-palette">
          <p className="book-palette-title">decorate page {pageIndex + 1}</p>
          <div className="book-palette-row">
            {EMOJI_PALETTE.map((e) => (
              <button key={e} onClick={() => addEmojiSticker(e)} className="book-palette-emoji">{e}</button>
            ))}
          </div>
          <div className="book-palette-row">
            <button onClick={addText} className="btn btn-ghost book-palette-text-btn">📝 add text</button>
          </div>
          <p className="book-palette-hint">drag stickers on the page · double-click to remove</p>
          <div className="book-palette-actions">
            <button onClick={saveEditing} disabled={saving || !dirty} className="btn btn-primary">
              {saving ? "saving…" : dirty ? "✓ save" : "saved"}
            </button>
            <button onClick={cancelEditing} className="btn btn-ghost">cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function DebugCube() {
  // shown while Suspense waits — if you see a coral cube, three.js works
  // but something in the Book subtree is still loading.
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#e07856" />
    </mesh>
  );
}

function Book({ places, pageIndex, editing, onTurnRight, onTurnLeft, onMoveDecoration, onRemoveDecoration }) {
  return (
    <group>
      {/* cover (flippable like a page) — sits on top of the stack */}
      <FlipPage
        flipped={pageIndex > -1}
        z={(places.length + 1) * PAGE_GAP}
        onClickFront={editing ? null : onTurnRight}
        onClickBack={editing ? null : onTurnLeft}
      >
        <CoverFace />
      </FlipPage>

      {/* each memory is a page, stacked behind the cover */}
      {places.map((place, i) => (
        <FlipPage
          key={place.id}
          flipped={i < pageIndex}
          z={(places.length - i) * PAGE_GAP}
          onClickFront={editing ? null : onTurnRight}
          onClickBack={editing ? null : onTurnLeft}
        >
          <MemoryFace
            place={place}
            index={i}
            editing={editing && i === pageIndex}
            onMoveDecoration={onMoveDecoration}
            onRemoveDecoration={onRemoveDecoration}
          />
        </FlipPage>
      ))}
    </group>
  );
}

function FlipPage({ flipped, z, children, onClickFront, onClickBack }) {
  const { rotation } = useSpring({
    rotation: flipped ? -Math.PI : 0,
    config: { mass: 1.4, tension: 65, friction: 22 },
  });
  return (
    <animated.group rotation-y={rotation} position={[0, 0, z]}>
      {/* offset content to the right so left edge of the page is the spine */}
      <group position={[PAGE_W / 2, 0, 0]}>
        {children}
        {/* invisible click hitboxes — disabled when editing so decorations capture clicks instead */}
        {onClickFront && (
          <mesh position={[0, 0, 0.001]} onClick={(e) => { e.stopPropagation(); onClickFront(); }}>
            <planeGeometry args={[PAGE_W, PAGE_H]} />
            <meshBasicMaterial transparent opacity={0} />
          </mesh>
        )}
        {onClickBack && (
          <mesh position={[0, 0, -0.001]} rotation={[0, Math.PI, 0]} onClick={(e) => { e.stopPropagation(); onClickBack(); }}>
            <planeGeometry args={[PAGE_W, PAGE_H]} />
            <meshBasicMaterial transparent opacity={0} />
          </mesh>
        )}
      </group>
    </animated.group>
  );
}

function CoverFace() {
  const GOLD = "#e6c358";
  const GOLD_DEEP = "#b8961f";
  const LEATHER = "#3a2010";
  const LEATHER_LIGHT = "#5a3018";

  return (
    <group>
      {/* base leather — deep rich brown */}
      <mesh>
        <planeGeometry args={[PAGE_W, PAGE_H]} />
        <meshBasicMaterial color={LEATHER} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>

      {/* outer gold band */}
      <mesh position={[0, 0, 0.001]}>
        <planeGeometry args={[PAGE_W - 0.12, PAGE_H - 0.12]} />
        <meshBasicMaterial color={GOLD} toneMapped={false} />
      </mesh>

      {/* leather inset between two gold lines */}
      <mesh position={[0, 0, 0.002]}>
        <planeGeometry args={[PAGE_W - 0.16, PAGE_H - 0.16]} />
        <meshBasicMaterial color={LEATHER_LIGHT} toneMapped={false} />
      </mesh>

      {/* inner gold thin line */}
      <mesh position={[0, 0, 0.003]}>
        <planeGeometry args={[PAGE_W - 0.26, PAGE_H - 0.26]} />
        <meshBasicMaterial color={GOLD} toneMapped={false} />
      </mesh>

      {/* main inner panel where the title sits */}
      <mesh position={[0, 0, 0.004]}>
        <planeGeometry args={[PAGE_W - 0.30, PAGE_H - 0.30]} />
        <meshBasicMaterial color={LEATHER_LIGHT} toneMapped={false} />
      </mesh>

      {/* corner gold diamonds */}
      {[
        [-(PAGE_W / 2) + 0.32, (PAGE_H / 2) - 0.32],
        [ (PAGE_W / 2) - 0.32, (PAGE_H / 2) - 0.32],
        [-(PAGE_W / 2) + 0.32, -(PAGE_H / 2) + 0.32],
        [ (PAGE_W / 2) - 0.32, -(PAGE_H / 2) + 0.32],
      ].map(([x, y], i) => (
        <Text
          key={`corner-${i}`}
          position={[x, y, 0.005]}
          fontSize={0.16}
          color={GOLD}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.004}
          outlineColor={LEATHER}
        >
          ✦
        </Text>
      ))}

      {/* "Yours" — big embossed gold */}
      <Text
        position={[0, 0.7, 0.008]}
        fontSize={0.46}
        color={GOLD}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.018}
        outlineColor={LEATHER}
        letterSpacing={0.04}
      >
        Yours
      </Text>

      {/* "Truly" */}
      <Text
        position={[0, 0.15, 0.008]}
        fontSize={0.46}
        color={GOLD}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.018}
        outlineColor={LEATHER}
        letterSpacing={0.04}
      >
        Truly
      </Text>

      {/* gold flourish divider */}
      <Text
        position={[0, -0.32, 0.008]}
        fontSize={0.18}
        color={GOLD}
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.3}
      >
        ✦ · ♡ · ✦
      </Text>

      {/* subtitle */}
      <Text
        position={[0, -0.62, 0.008]}
        fontSize={0.075}
        color={GOLD_DEEP}
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.35}
        outlineWidth={0.001}
        outlineColor={LEATHER}
      >
        A SCRAPBOOK OF PLACES
      </Text>

      {/* bottom imprint stamp */}
      <Text
        position={[0, -1.18, 0.008]}
        fontSize={0.065}
        color={GOLD}
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.5}
      >
        — VOL. I · MMXXVI —
      </Text>
    </group>
  );
}

function MemoryFace({ place, index, editing, onMoveDecoration, onRemoveDecoration }) {
  const stars = place.rating > 0 ? "★".repeat(place.rating) + "☆".repeat(5 - place.rating) : "";
  const reviewLines = useMemo(() => {
    const r = (place.review || "").trim();
    return r;
  }, [place.review]);

  // prefer the first original photo (clean) over the collage which has text baked in
  const pageImageUrl = useMemo(() => {
    if (Array.isArray(place.photos) && place.photos.length > 0) return place.photos[0];
    return place.photo_url || null;
  }, [place.photos, place.photo_url]);

  const notebookTexture = getNotebookTexture();

  return (
    <group>
      {/* lined notebook paper — light blue with horizontal rules + red margin */}
      <mesh>
        <planeGeometry args={[PAGE_W, PAGE_H]} />
        <meshBasicMaterial
          map={notebookTexture}
          color={notebookTexture ? "#ffffff" : "#dde9f3"}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* page number top-right */}
      <Text
        position={[PAGE_W / 2 - 0.18, PAGE_H / 2 - 0.18, 0.01]}
        fontSize={0.08}
        color="#8a7259"
        anchorX="right"
        anchorY="top"
      >
        — {index + 1} —
      </Text>

      {/* polaroid photo (top half of page) */}
      {pageImageUrl ? (
        <PhotoPolaroid url={pageImageUrl} />
      ) : (
        <PhotoPlaceholder />
      )}

      {/* name */}
      <Text
        position={[0, -0.05, 0.012]}
        fontSize={0.22}
        color="#2a2a2a"
        anchorX="center"
        anchorY="middle"
        maxWidth={PAGE_W * 0.85}
        textAlign="center"
      >
        {place.name}
      </Text>

      {/* location */}
      {place.location && (
        <Text
          position={[0, -0.42, 0.012]}
          fontSize={0.09}
          color="#5a4a3a"
          anchorX="center"
          anchorY="middle"
          maxWidth={PAGE_W * 0.85}
          textAlign="center"
        >
          {`📍 ${place.location}`}
        </Text>
      )}

      {/* stars */}
      {stars && (
        <Text
          position={[0, -0.68, 0.012]}
          fontSize={0.14}
          color="#f4b400"
          anchorX="center"
          anchorY="middle"
          letterSpacing={0.1}
        >
          {stars}
        </Text>
      )}

      {/* review */}
      {reviewLines && (
        <Text
          position={[0, -1.05, 0.012]}
          fontSize={0.085}
          color="#2a2a2a"
          anchorX="center"
          anchorY="top"
          maxWidth={PAGE_W * 0.82}
          lineHeight={1.45}
          textAlign="center"
        >
          {`"${reviewLines}"`}
        </Text>
      )}

      {/* user-added decorations: stickers + text overlays */}
      {Array.isArray(place.decorations) && place.decorations.map((dec) => (
        <DecorationOnPage
          key={dec.id}
          decoration={dec}
          editing={editing}
          onMove={(x, y) => onMoveDecoration(dec.id, x, y)}
          onRemove={() => onRemoveDecoration(dec.id)}
        />
      ))}
    </group>
  );
}

function DecorationOnPage({ decoration, editing, onMove, onRemove }) {
  const { x, y, size, rotation } = decorationToWorld(decoration);
  const Z = 0.025; // above all page content
  const [hovered, setHovered] = useState(false);
  const dragStateRef = useRef({ dragging: false });

  function onPointerDown(e) {
    if (!editing) return;
    e.stopPropagation();
    e.target.setPointerCapture?.(e.pointerId);
    dragStateRef.current.dragging = true;
  }
  function onPointerMove(e) {
    if (!editing || !dragStateRef.current.dragging) return;
    e.stopPropagation();
    // e.point is world-space intersection (with the hitbox plane)
    // page is at world origin (book is centered via outer group offset)
    const xPct = (e.point.x / PAGE_W + 0.5) * 100;
    const yPct = (-e.point.y / PAGE_H + 0.5) * 100;
    onMove(Math.max(2, Math.min(98, xPct)), Math.max(2, Math.min(98, yPct)));
  }
  function onPointerUp(e) {
    if (!editing) return;
    e.target.releasePointerCapture?.(e.pointerId);
    dragStateRef.current.dragging = false;
  }
  function onDoubleClick(e) {
    if (!editing) return;
    e.stopPropagation();
    if (window.confirm(`remove this ${decoration.type}?`)) onRemove();
  }

  // hitbox size — generous so emojis/text are easy to grab
  const hit = Math.max(size * 1.6, 0.35);

  const isImage = decoration.type === "sticker" && decoration.imageUrl;
  const isEmoji = decoration.type === "sticker" && !decoration.imageUrl;
  const isText  = decoration.type === "text";

  return (
    <group position={[x, y, Z]} rotation={[0, 0, rotation]}>
      {/* invisible drag-and-double-click hitbox (only mounted in edit mode) */}
      {editing && (
        <mesh
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onDoubleClick={onDoubleClick}
          onPointerOver={() => setHovered(true)}
          onPointerOut={() => setHovered(false)}
        >
          <planeGeometry args={[hit, hit]} />
          <meshBasicMaterial
            color={hovered ? "#e07856" : "#000000"}
            transparent
            opacity={hovered ? 0.18 : 0.001}
            depthWrite={false}
          />
        </mesh>
      )}

      {isEmoji && (
        <Text fontSize={size} color="#000000" anchorX="center" anchorY="middle">
          {decoration.emoji}
        </Text>
      )}
      {isText && (
        <Text
          fontSize={size}
          color={decoration.color || "#e07856"}
          anchorX="center"
          anchorY="middle"
          outlineWidth={size * 0.02}
          outlineColor="#fffdf7"
          outlineBlur={size * 0.04}
        >
          {decoration.content}
        </Text>
      )}
      {isImage && <ImageStickerMesh url={decoration.imageUrl} size={size} />}
    </group>
  );
}

function ImageStickerMesh({ url, size }) {
  const [texture, setTexture] = useState(null);
  const [aspect, setAspect] = useState(1);

  useEffect(() => {
    let cancelled = false;
    const img = new window.Image();
    if (!url.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      const tex = new THREE.Texture(img);
      tex.needsUpdate = true;
      tex.colorSpace = THREE.SRGBColorSpace;
      setTexture(tex);
      setAspect(img.width / Math.max(1, img.height));
    };
    img.src = url;
    return () => { cancelled = true; };
  }, [url]);

  if (!texture) return null;
  const w = size;
  const h = size / aspect;
  return (
    <mesh>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} />
    </mesh>
  );
}


// Polaroid-style photo: preserves aspect ratio, white border, tape strip
function PhotoPolaroid({ url }) {
  const [texture, setTexture] = useState(null);
  const [aspect, setAspect] = useState(1);

  useEffect(() => {
    let cancelled = false;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      const tex = new THREE.Texture(img);
      tex.needsUpdate = true;
      tex.colorSpace = THREE.SRGBColorSpace;
      setTexture(tex);
      setAspect(img.width / Math.max(1, img.height));
    };
    img.src = url;
    return () => { cancelled = true; };
  }, [url]);

  // fit inside a 2.0 wide × 1.4 tall envelope, preserving aspect
  const ENV_W = 2.0;
  const ENV_H = 1.4;
  let w, h;
  if (aspect > ENV_W / ENV_H) {
    w = ENV_W;
    h = ENV_W / aspect;
  } else {
    h = ENV_H;
    w = ENV_H * aspect;
  }

  const borderSide = 0.09;
  const borderTop = 0.09;
  const borderBottom = 0.22;

  return (
    <group position={[0, 1.15, 0.012]} rotation={[0, 0, -0.04]}>
      {/* white polaroid backing */}
      <mesh position={[0, (borderTop - borderBottom) / 2, 0]}>
        <planeGeometry args={[w + borderSide * 2, h + borderTop + borderBottom]} />
        <meshBasicMaterial color="#fffdf7" toneMapped={false} />
      </mesh>
      {/* drop-shadow approximation: dark slightly larger plane just behind */}
      <mesh position={[0.03, (borderTop - borderBottom) / 2 - 0.03, -0.002]}>
        <planeGeometry args={[w + borderSide * 2 + 0.04, h + borderTop + borderBottom + 0.04]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.18} toneMapped={false} />
      </mesh>
      {/* the photo */}
      {texture && (
        <mesh position={[0, 0, 0.001]}>
          <planeGeometry args={[w, h]} />
          <meshBasicMaterial map={texture} toneMapped={false} />
        </mesh>
      )}
      {/* washi tape strip at top */}
      <mesh position={[0, h / 2 + borderTop + 0.04, 0.003]} rotation={[0, 0, -0.12]}>
        <planeGeometry args={[0.75, 0.16]} />
        <meshBasicMaterial color="#f7c5cc" transparent opacity={0.88} toneMapped={false} />
      </mesh>
    </group>
  );
}

function PhotoPlaceholder() {
  return (
    <group position={[0, 1.15, 0.012]} rotation={[0, 0, -0.04]}>
      <mesh>
        <planeGeometry args={[2.0, 1.5]} />
        <meshBasicMaterial color="#fffdf7" toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, 0.001]}>
        <planeGeometry args={[1.84, 1.34]} />
        <meshBasicMaterial color="#f7c8a9" toneMapped={false} />
      </mesh>
      <Text position={[0, 0, 0.002]} fontSize={0.45} color="#fffdf7" anchorX="center" anchorY="middle">
        📷
      </Text>
    </group>
  );
}
