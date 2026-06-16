"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const STICKERS = ["♥", "♡", "★", "✦", "✨", "🌸", "🌟", "🌷", "💕", "💫", "🎀", "🌙", "📍", "🦋", "🍓"];
const TEXT_COLORS = [
  { name: "coral",  value: "#e07856" },
  { name: "wine",   value: "#b23c2a" },
  { name: "sage",   value: "#6b9080" },
  { name: "ink",    value: "#2a2a2a" },
  { name: "yellow", value: "#c79a18" },
];

let idCounter = 0;
const newId = () => `d${Date.now()}-${idCounter++}`;

export default function DecorationLayer({ place, isOwner }) {
  const [decorations, setDecorations] = useState(place.decorations || []);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const containerRef = useRef(null);

  function addSticker(emoji) {
    setDecorations((d) => [
      ...d,
      {
        id: newId(),
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
    setDecorations((d) => [
      ...d,
      {
        id: newId(),
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

  function updateDecoration(id, patch) {
    setDecorations((d) => d.map((dec) => (dec.id === id ? { ...dec, ...patch } : dec)));
  }

  function removeDecoration(id) {
    setDecorations((d) => d.filter((dec) => dec.id !== id));
  }

  async function save() {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("places")
      .update({ decorations })
      .eq("id", place.id);
    setBusy(false);
    if (error) {
      alert(error.message);
      return;
    }
    setEditing(false);
  }

  function cancel() {
    setDecorations(place.decorations || []);
    setEditing(false);
  }

  return (
    <>
      <div ref={containerRef} className="decoration-layer">
        {decorations.map((dec) => (
          <DecorationItem
            key={dec.id}
            decoration={dec}
            editing={editing}
            containerRef={containerRef}
            onUpdate={(patch) => updateDecoration(dec.id, patch)}
            onRemove={() => removeDecoration(dec.id)}
          />
        ))}
      </div>

      {isOwner && !editing && (
        <button onClick={() => setEditing(true)} className="btn btn-ghost decorate-toggle">
          ✏️ decorate this page
        </button>
      )}

      {editing && (
        <div className="decoration-palette">
          <p className="palette-section-label">add a sticker</p>
          <div className="palette-stickers">
            {STICKERS.map((s) => (
              <button key={s} type="button" onClick={() => addSticker(s)} className="palette-sticker">
                {s}
              </button>
            ))}
          </div>
          <p className="palette-section-label">add text</p>
          <div className="palette-actions">
            <button type="button" onClick={addText} className="btn btn-ghost">📝 add a note</button>
          </div>
          <p className="palette-hint">drag to move · double-click sticker/text to remove · click colored dot on text to change color</p>
          <div className="palette-save-row">
            <button type="button" onClick={save} className="btn btn-primary" disabled={busy}>
              {busy ? "saving…" : "✓ save"}
            </button>
            <button type="button" onClick={cancel} className="btn btn-ghost">cancel</button>
          </div>
        </div>
      )}
    </>
  );
}

function DecorationItem({ decoration, editing, containerRef, onUpdate, onRemove }) {
  const itemRef = useRef(null);
  const stateRef = useRef({ dragging: false });

  useEffect(() => {
    if (!editing) return;
    const item = itemRef.current;
    if (!item) return;

    function onDown(e) {
      e.preventDefault();
      e.stopPropagation();
      const isTouch = e.type === "touchstart";
      const point = isTouch ? e.touches[0] : e;
      stateRef.current.dragging = true;
      stateRef.current.startMouse = { x: point.clientX, y: point.clientY };
      stateRef.current.startPos = { x: decoration.x, y: decoration.y };
      stateRef.current.moved = false;
    }
    function onMove(e) {
      if (!stateRef.current.dragging) return;
      const point = e.touches ? e.touches[0] : e;
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const dx = ((point.clientX - stateRef.current.startMouse.x) / rect.width) * 100;
      const dy = ((point.clientY - stateRef.current.startMouse.y) / rect.height) * 100;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) stateRef.current.moved = true;
      const newX = Math.max(2, Math.min(98, stateRef.current.startPos.x + dx));
      const newY = Math.max(2, Math.min(98, stateRef.current.startPos.y + dy));
      onUpdate({ x: newX, y: newY });
    }
    function onUp() {
      stateRef.current.dragging = false;
    }

    item.addEventListener("mousedown", onDown);
    item.addEventListener("touchstart", onDown, { passive: false });
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchend", onUp);

    return () => {
      item.removeEventListener("mousedown", onDown);
      item.removeEventListener("touchstart", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchend", onUp);
    };
  }, [editing, decoration.x, decoration.y, containerRef, onUpdate]);

  function onDoubleClick() {
    if (!editing) return;
    if (window.confirm(`remove this ${decoration.type}?`)) onRemove();
  }

  function cycleColor() {
    if (!editing || decoration.type !== "text") return;
    const idx = TEXT_COLORS.findIndex((c) => c.value === decoration.color);
    const next = TEXT_COLORS[(idx + 1) % TEXT_COLORS.length].value;
    onUpdate({ color: next });
  }

  const baseStyle = {
    position: "absolute",
    left: `${decoration.x}%`,
    top: `${decoration.y}%`,
    transform: `translate(-50%, -50%) rotate(${decoration.rotation}deg)`,
    fontSize: decoration.size,
    cursor: editing ? "grab" : "default",
    userSelect: "none",
    touchAction: "none",
    pointerEvents: editing ? "auto" : "none",
    lineHeight: 1,
    fontFamily: decoration.type === "text" ? "var(--ff-caveat)" : "inherit",
    color: decoration.color || "inherit",
    fontWeight: decoration.type === "text" ? 700 : "normal",
    textShadow: decoration.type === "text" ? "1px 1px 0 rgba(255,255,255,0.6)" : "none",
    filter: decoration.type === "sticker" ? "drop-shadow(0 4px 6px rgba(0,0,0,0.25))" : "none",
    whiteSpace: "nowrap",
  };

  return (
    <div ref={itemRef} style={baseStyle} onDoubleClick={onDoubleClick} className={editing ? "decoration-editing" : ""}>
      {decoration.type === "sticker" ? decoration.emoji : decoration.content}
      {editing && decoration.type === "text" && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); cycleColor(); }}
          style={{
            position: "absolute",
            top: "-12px",
            right: "-12px",
            width: 18,
            height: 18,
            borderRadius: "50%",
            border: "2px solid white",
            background: decoration.color || "#000",
            cursor: "pointer",
            padding: 0,
            fontSize: 0,
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
          }}
          title="change color"
        />
      )}
    </div>
  );
}
