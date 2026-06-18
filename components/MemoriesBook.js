"use client";

import { Suspense, useState, useMemo, useEffect, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
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
  const [selectedId, setSelectedId] = useState(null);
  const [lastSavedAt, setLastSavedAt] = useState(0);
  const originalDecorationsRef = useRef({}); // placeId → original decorations (for cancel)
  const saveTimerRef = useRef(null);

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

  async function saveSilently() {
    if (pageIndex < 0) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("places")
      .update({ decorations: currentPlace.decorations || [] })
      .eq("id", currentPlace.id);
    setSaving(false);
    if (error) return; // silent failure — user will see "unsaved" indicator
    setDirty(false);
    setLastSavedAt(Date.now());
  }

  // Debounced auto-save: 1.2s after the last change
  useEffect(() => {
    if (!editing || !dirty || !currentPlace) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => { saveSilently(); }, 1200);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [dirty, editing, pageIndex, currentPlace?.decorations]); // eslint-disable-line

  async function doneEditing() {
    if (dirty) await saveSilently();
    delete originalDecorationsRef.current[currentPlace?.id];
    setEditing(false);
    setSelectedId(null);
  }

  function addEmojiSticker(emoji) {
    updateCurrentDecorations((decs) => [
      ...decs,
      {
        id: newDecoId(),
        type: "sticker",
        emoji,
        // jitter so multiple stickers don't pile at dead center
        x: 50 + (Math.random() * 30 - 15),
        y: 50 + (Math.random() * 30 - 15),
        rotation: Math.floor(Math.random() * 30) - 15,
        size: 56,
      },
    ]);
  }

  function addTextDecoration(content) {
    const trimmed = (content || "").trim();
    if (!trimmed) return;
    updateCurrentDecorations((decs) => [
      ...decs,
      {
        id: newDecoId(),
        type: "text",
        content: trimmed,
        x: 50 + (Math.random() * 20 - 10),
        y: 50 + (Math.random() * 20 - 10),
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
    if (selectedId === decId) setSelectedId(null);
  }
  function resizeDecoration(decId, size) {
    updateCurrentDecorations((decs) => decs.map((d) => d.id === decId ? { ...d, size } : d));
  }
  function rotateDecoration(decId, rotation) {
    updateCurrentDecorations((decs) => decs.map((d) => d.id === decId ? { ...d, rotation } : d));
  }
  function selectDecoration(decId) {
    setSelectedId(decId);
  }
  const selectedDecoration = currentPlace?.decorations?.find((d) => d.id === selectedId) || null;

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
              selectedId={selectedId}
              onTurnRight={() => canNext && setPageIndex(pageIndex + 1)}
              onTurnLeft={() => canPrev && setPageIndex(pageIndex - 1)}
              onMoveDecoration={moveDecoration}
              onRemoveDecoration={removeDecoration}
              onSelectDecoration={selectDecoration}
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
        <BookPalette
          pageIndex={pageIndex}
          onAddEmoji={addEmojiSticker}
          onAddText={addTextDecoration}
          onDone={doneEditing}
          onCancel={cancelEditing}
          saving={saving}
          dirty={dirty}
          lastSavedAt={lastSavedAt}
          selectedDecoration={selectedDecoration}
          onResize={(size) => selectedId && resizeDecoration(selectedId, size)}
          onRotate={(rot) => selectedId && rotateDecoration(selectedId, rot)}
          onRemoveSelected={() => selectedId && removeDecoration(selectedId)}
        />
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

function BookPalette({
  pageIndex,
  onAddEmoji,
  onAddText,
  onDone,
  onCancel,
  saving,
  dirty,
  lastSavedAt,
  selectedDecoration,
  onResize,
  onRotate,
  onRemoveSelected,
}) {
  const [textInputOpen, setTextInputOpen] = useState(false);
  const [textValue, setTextValue] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (textInputOpen) inputRef.current?.focus();
  }, [textInputOpen]);

  function commitText() {
    if (textValue.trim()) onAddText(textValue);
    setTextValue("");
    setTextInputOpen(false);
  }

  // human-friendly saved-status
  let saveLabel = "✓ all saved";
  if (saving) saveLabel = "saving…";
  else if (dirty) saveLabel = "saving in a moment…";
  else if (lastSavedAt > 0) saveLabel = "✓ saved";

  return (
    <div className="book-palette">
      <div className="book-palette-header">
        <p className="book-palette-title">decorating page {pageIndex + 1}</p>
        <span className={`book-palette-status ${dirty || saving ? "is-pending" : ""}`}>{saveLabel}</span>
      </div>

      {selectedDecoration ? (
        // SELECTED MODE: show controls for the picked sticker/text
        <div className="book-selected-controls">
          <p className="book-selected-label">
            tap empty space to add new · drag to move · double-click to remove
          </p>
          <div className="book-control-row">
            <label className="book-control-label">size</label>
            <input
              type="range"
              min={selectedDecoration.type === "text" ? 14 : 24}
              max={selectedDecoration.type === "text" ? 80 : 160}
              value={selectedDecoration.size}
              onChange={(e) => onResize(Number(e.target.value))}
              className="book-control-slider"
            />
          </div>
          <div className="book-control-row">
            <label className="book-control-label">rotate</label>
            <input
              type="range"
              min={-45}
              max={45}
              value={selectedDecoration.rotation || 0}
              onChange={(e) => onRotate(Number(e.target.value))}
              className="book-control-slider"
            />
          </div>
          <div className="book-palette-row" style={{ justifyContent: "flex-end" }}>
            <button onClick={onRemoveSelected} className="btn btn-ghost" style={{ color: "var(--coral-deep)", fontSize: 13 }}>
              🗑 remove this
            </button>
          </div>
        </div>
      ) : null}

      <div className="book-palette-row">
        {EMOJI_PALETTE.map((e) => (
          <button key={e} onClick={() => onAddEmoji(e)} className="book-palette-emoji">{e}</button>
        ))}
      </div>

      {textInputOpen ? (
        <div className="book-palette-row book-text-row">
          <input
            ref={inputRef}
            className="book-text-input"
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitText();
              if (e.key === "Escape") { setTextInputOpen(false); setTextValue(""); }
            }}
            placeholder="✨ what does it say?"
            maxLength={80}
          />
          <button onClick={commitText} className="btn btn-primary book-text-add">add</button>
          <button onClick={() => { setTextInputOpen(false); setTextValue(""); }} className="btn btn-ghost book-text-cancel">×</button>
        </div>
      ) : (
        <div className="book-palette-row">
          <button onClick={() => setTextInputOpen(true)} className="btn btn-ghost book-palette-text-btn">📝 add text</button>
        </div>
      )}

      <p className="book-palette-hint">tap any sticker to select & resize · drag to move · double-click to remove</p>
      <div className="book-palette-actions">
        <button onClick={onDone} className="btn btn-primary" disabled={saving}>
          ✓ done
        </button>
        <button onClick={onCancel} className="btn btn-ghost">undo all changes</button>
      </div>
    </div>
  );
}

function Book({ places, pageIndex, editing, selectedId, onTurnRight, onTurnLeft, onMoveDecoration, onRemoveDecoration, onSelectDecoration }) {
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
            selectedId={selectedId}
            onMoveDecoration={onMoveDecoration}
            onRemoveDecoration={onRemoveDecoration}
            onSelectDecoration={onSelectDecoration}
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

function MemoryFace({ place, index, editing, selectedId, onMoveDecoration, onRemoveDecoration, onSelectDecoration }) {
  const stars = place.rating > 0 ? "★".repeat(place.rating) + "☆".repeat(5 - place.rating) : "";
  const reviewLines = useMemo(() => {
    const r = (place.review || "").trim();
    return r;
  }, [place.review]);

  // collect every original photo (up to 4) — prefer photos[] over the collage photo_url
  const pageImageUrls = useMemo(() => {
    if (Array.isArray(place.photos) && place.photos.length > 0) {
      return place.photos.slice(0, 4);
    }
    return place.photo_url ? [place.photo_url] : [];
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

      {/* polaroid photo(s) — multi-photo collage layout in top half of page */}
      {pageImageUrls.length > 0 ? (
        <PhotoLayout urls={pageImageUrls} />
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
          selected={selectedId === dec.id}
          onMove={(x, y) => onMoveDecoration(dec.id, x, y)}
          onRemove={() => onRemoveDecoration(dec.id)}
          onSelect={() => onSelectDecoration?.(dec.id)}
        />
      ))}
    </group>
  );
}

function DecorationOnPage({ decoration, editing, selected, onMove, onRemove, onSelect }) {
  const { x, y, size, rotation } = decorationToWorld(decoration);
  const Z = 0.025; // above all page content
  const [hovered, setHovered] = useState(false);
  const { camera, gl } = useThree();
  const dragMovedRef = useRef(false);

  function onPointerDown(e) {
    if (!editing) return;
    e.stopPropagation();
    e.nativeEvent?.preventDefault?.();
    dragMovedRef.current = false;
    // Select immediately on press (even without dragging)
    onSelect?.();

    const raycaster = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const intersect = new THREE.Vector3();
    const ndc = new THREE.Vector2();
    const canvas = gl.domElement;
    const startX = e.nativeEvent?.clientX ?? 0;
    const startY = e.nativeEvent?.clientY ?? 0;

    function screenToWorldOnPage(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      const ok = raycaster.ray.intersectPlane(plane, intersect);
      return ok ? intersect : null;
    }

    function onMoveDoc(we) {
      const dx = we.clientX - startX;
      const dy = we.clientY - startY;
      if (Math.abs(dx) + Math.abs(dy) > 3) dragMovedRef.current = true;
      const p = screenToWorldOnPage(we.clientX, we.clientY);
      if (!p) return;
      const xPct = (p.x / PAGE_W + 0.5) * 100;
      const yPct = (-p.y / PAGE_H + 0.5) * 100;
      onMove(Math.max(2, Math.min(98, xPct)), Math.max(2, Math.min(98, yPct)));
    }
    function onUpDoc() {
      window.removeEventListener("pointermove", onMoveDoc);
      window.removeEventListener("pointerup", onUpDoc);
      window.removeEventListener("pointercancel", onUpDoc);
    }
    window.addEventListener("pointermove", onMoveDoc);
    window.addEventListener("pointerup", onUpDoc);
    window.addEventListener("pointercancel", onUpDoc);
  }

  function onDoubleClick(e) {
    if (!editing) return;
    e.stopPropagation();
    if (window.confirm(`remove this ${decoration.type}?`)) onRemove();
  }

  // hitbox size — generous so emojis/text are easy to grab. Bigger when selected.
  const hit = Math.max(size * (selected ? 2.2 : 1.8), 0.45);

  const isImage = decoration.type === "sticker" && decoration.imageUrl;
  const isEmoji = decoration.type === "sticker" && !decoration.imageUrl;
  const isText  = decoration.type === "text";

  return (
    <group position={[x, y, Z]} rotation={[0, 0, rotation]}>
      {/* invisible drag-and-double-click hitbox (only mounted in edit mode) */}
      {editing && (
        <>
          {/* selection ring — only visible when selected */}
          {selected && (
            <mesh position={[0, 0, -0.001]}>
              <ringGeometry args={[hit / 2 + 0.01, hit / 2 + 0.05, 32]} />
              <meshBasicMaterial color="#e07856" transparent opacity={0.7} />
            </mesh>
          )}
          <mesh
            onPointerDown={onPointerDown}
            onDoubleClick={onDoubleClick}
            onPointerOver={() => setHovered(true)}
            onPointerOut={() => setHovered(false)}
          >
            <planeGeometry args={[hit, hit]} />
            <meshBasicMaterial
              color={selected ? "#e07856" : hovered ? "#e07856" : "#000000"}
              transparent
              opacity={selected ? 0.18 : hovered ? 0.14 : 0.001}
              depthWrite={false}
            />
          </mesh>
        </>
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


// Layout configurations for 1-4 photos on a book page
// Each slot: cx/cy = center position, envW/envH = bounding envelope,
//            rot = z-rotation in radians, tape = washi tape color
const PHOTO_LAYOUTS = {
  1: [{ cx: 0, cy: 1.15, envW: 2.0, envH: 1.4, rot: -0.04, tape: "#f7c5cc" }],
  2: [
    { cx: -0.78, cy: 1.30, envW: 1.45, envH: 1.05, rot: -0.16, tape: "#f7c5cc" },
    { cx:  0.78, cy: 1.00, envW: 1.45, envH: 1.05, rot:  0.12, tape: "#ffd966" },
  ],
  3: [
    { cx: -0.80, cy: 1.55, envW: 1.15, envH: 0.85, rot: -0.21, tape: "#f7c5cc" },
    { cx:  0.80, cy: 1.45, envW: 1.15, envH: 0.85, rot:  0.14, tape: "#ffd966" },
    { cx:  0.05, cy: 0.55, envW: 1.25, envH: 0.95, rot: -0.05, tape: "#b8dbc4" },
  ],
  4: [
    { cx: -0.78, cy: 1.65, envW: 1.00, envH: 0.78, rot: -0.18, tape: "#f7c5cc" },
    { cx:  0.78, cy: 1.62, envW: 1.00, envH: 0.78, rot:  0.12, tape: "#ffd966" },
    { cx: -0.75, cy: 0.55, envW: 1.00, envH: 0.78, rot:  0.10, tape: "#b8dbc4" },
    { cx:  0.78, cy: 0.45, envW: 1.00, envH: 0.78, rot: -0.14, tape: "#ffb59a" },
  ],
};

function PhotoLayout({ urls }) {
  const slots = PHOTO_LAYOUTS[Math.min(urls.length, 4)] || PHOTO_LAYOUTS[1];
  return (
    <>
      {urls.slice(0, 4).map((url, i) => (
        <PhotoPolaroid key={`${url}-${i}`} url={url} {...slots[i]} />
      ))}
    </>
  );
}

// Polaroid-style photo: preserves aspect ratio, white border, tape strip
function PhotoPolaroid({ url, cx, cy, envW, envH, rot, tape }) {
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

  // fit inside envelope preserving aspect ratio
  let w, h;
  if (aspect > envW / envH) {
    w = envW;
    h = envW / aspect;
  } else {
    h = envH;
    w = envH * aspect;
  }

  // smaller borders when slots are smaller
  const scale = envW / 2.0; // 1.0 for the single-photo layout, smaller otherwise
  const borderSide = 0.07 * scale + 0.02;
  const borderTop = 0.07 * scale + 0.02;
  const borderBottom = 0.16 * scale + 0.05;
  const tapeWidth = 0.55 * scale + 0.15;
  const tapeHeight = 0.13 * scale + 0.04;

  return (
    <group position={[cx, cy, 0.012]} rotation={[0, 0, rot]}>
      {/* drop shadow */}
      <mesh position={[0.03, (borderTop - borderBottom) / 2 - 0.03, -0.002]}>
        <planeGeometry args={[w + borderSide * 2 + 0.04, h + borderTop + borderBottom + 0.04]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.20} toneMapped={false} />
      </mesh>
      {/* white polaroid backing */}
      <mesh position={[0, (borderTop - borderBottom) / 2, 0]}>
        <planeGeometry args={[w + borderSide * 2, h + borderTop + borderBottom]} />
        <meshBasicMaterial color="#fffdf7" toneMapped={false} />
      </mesh>
      {/* the photo */}
      {texture && (
        <mesh position={[0, 0, 0.001]}>
          <planeGeometry args={[w, h]} />
          <meshBasicMaterial map={texture} toneMapped={false} />
        </mesh>
      )}
      {/* washi tape strip at top, opposite tilt to the polaroid */}
      <mesh position={[0, h / 2 + borderTop + 0.04, 0.003]} rotation={[0, 0, -rot - 0.1]}>
        <planeGeometry args={[tapeWidth, tapeHeight]} />
        <meshBasicMaterial color={tape} transparent opacity={0.88} toneMapped={false} />
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
