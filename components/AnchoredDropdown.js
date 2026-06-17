"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Renders children as a dropdown anchored to a target element's bottom-left,
 * portaled into <body> so no parent stacking context can clip or layer over it.
 * - anchorRef: ref to the input/element to anchor under
 * - open: boolean controlling visibility
 * - children: dropdown content
 */
export default function AnchoredDropdown({ anchorRef, open, children, className = "" }) {
  const [rect, setRect] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    function update() {
      const el = anchorRef.current;
      if (!el) return;
      setRect(el.getBoundingClientRect());
    }
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, anchorRef]);

  if (!mounted || !open || !rect) return null;

  const style = {
    position: "fixed",
    top: rect.bottom + 8,
    left: rect.left,
    width: rect.width,
    zIndex: 99999,
  };

  return createPortal(
    <div className={className} style={style}>
      {children}
    </div>,
    document.body
  );
}
