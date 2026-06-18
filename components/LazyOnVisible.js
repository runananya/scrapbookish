"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Renders its children only after the wrapping div has been scrolled into view.
 * Useful for deferring heavy components (like a 3D book) until the user actually
 * looks at them, so the initial page load is faster.
 *
 * - placeholder: what to show before the children mount
 * - rootMargin: distance ahead of viewport at which to start loading (default "200px")
 */
export default function LazyOnVisible({ children, placeholder = null, rootMargin = "200px" }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    if (typeof IntersectionObserver === "undefined") {
      // graceful fallback: just render
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible, rootMargin]);

  return (
    <div ref={ref} style={{ width: "100%", height: "100%" }}>
      {visible ? children : placeholder}
    </div>
  );
}
