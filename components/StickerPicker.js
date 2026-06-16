"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";

export default function StickerPicker({ sheetUrl, label, onPick, onClose }) {
  const imgRef = useRef(null);
  const [region, setRegion] = useState(null); // {x, y, w, h} in display pixels (relative to image)
  const [drawing, setDrawing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  function getPoint(e) {
    const isTouch = e.touches?.[0];
    const point = isTouch || e;
    const rect = imgRef.current.getBoundingClientRect();
    return { x: point.clientX - rect.left, y: point.clientY - rect.top };
  }

  function onDown(e) {
    e.preventDefault();
    const { x, y } = getPoint(e);
    setRegion({ x, y, w: 0, h: 0 });
    setDrawing(true);
  }
  function onMove(e) {
    if (!drawing || !region) return;
    e.preventDefault();
    const { x, y } = getPoint(e);
    setRegion((r) => ({ ...r, w: x - r.x, h: y - r.y }));
  }
  function onUp() {
    setDrawing(false);
  }

  async function applyCrop() {
    if (!region || !imgRef.current) return;
    const imgRect = imgRef.current.getBoundingClientRect();
    const ratioX = imgRef.current.naturalWidth  / imgRect.width;
    const ratioY = imgRef.current.naturalHeight / imgRect.height;

    const dispX = region.w < 0 ? region.x + region.w : region.x;
    const dispY = region.h < 0 ? region.y + region.h : region.y;
    const sx = dispX * ratioX;
    const sy = dispY * ratioY;
    const sw = Math.abs(region.w) * ratioX;
    const sh = Math.abs(region.h) * ratioY;

    if (sw < 20 || sh < 20) {
      alert("draw a bigger box around the sticker");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(imgRef.current, sx, sy, sw, sh, 0, 0, sw, sh);
    const dataUrl = canvas.toDataURL("image/png");
    onPick(dataUrl);
  }

  // Visual box positioning (handles negative w/h from drag direction)
  const box = region && {
    left: region.w < 0 ? region.x + region.w : region.x,
    top:  region.h < 0 ? region.y + region.h : region.y,
    width:  Math.abs(region.w),
    height: Math.abs(region.h),
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <motion.div
        className="sticker-picker"
        onClick={(e) => e.stopPropagation()}
        initial={{ y: 30, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 30, opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 200, damping: 18 }}
      >
        <button onClick={onClose} className="rec-modal-close" aria-label="close">×</button>
        <h2 className="modal-title">pick a {label}</h2>
        <p className="modal-sub">drag a box around the sticker you want</p>

        <div className="picker-stage">
          <div
            className="picker-image-wrap"
            onMouseDown={onDown}
            onMouseMove={onMove}
            onMouseUp={onUp}
            onMouseLeave={onUp}
            onTouchStart={onDown}
            onTouchMove={onMove}
            onTouchEnd={onUp}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={sheetUrl}
              alt={label}
              className="picker-sheet"
              draggable={false}
              onLoad={() => setLoaded(true)}
            />
            {box && loaded && (
              <div className="picker-box" style={box} />
            )}
          </div>
        </div>

        <div className="picker-actions">
          <button
            onClick={applyCrop}
            disabled={!region || Math.abs(region.w) < 10 || Math.abs(region.h) < 10}
            className="btn btn-primary"
          >
            ✓ use this sticker
          </button>
          <button onClick={onClose} className="btn btn-ghost">cancel</button>
        </div>
      </motion.div>
    </div>
  );
}
