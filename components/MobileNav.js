"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Avatar from "./Avatar";

/**
 * Replaces the inline sticker nav links with a hamburger menu on small screens.
 * Renders the menu via portal so no parent stacking context can clip it.
 *
 * Props:
 * - links: [{ href, label, kind?: "primary"|"ghost"|"avatar"|"logout" }]
 * - profile: current user's profile (for avatar)
 * - onLogout: callback for logout
 */
export default function MobileNav({ links = [], profile, onLogout }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="mobile-nav-toggle"
        onClick={() => setOpen(true)}
        aria-label="open menu"
      >
        <span /><span /><span />
      </button>

      {mounted && open && createPortal(
        <div className="mobile-nav-overlay" onClick={() => setOpen(false)}>
          <div className="mobile-nav-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-nav-header">
              {profile && <Avatar profile={profile} size={48} />}
              <div>
                <p className="mobile-nav-name">{profile?.display_name || "you"}</p>
                <p className="mobile-nav-sub">your scrapbook</p>
              </div>
              <button
                type="button"
                className="mobile-nav-close"
                onClick={() => setOpen(false)}
                aria-label="close menu"
              >×</button>
            </div>

            <nav className="mobile-nav-links">
              {links.map((l, i) => (
                <Link
                  key={i}
                  href={l.href}
                  className="mobile-nav-link"
                  onClick={() => setOpen(false)}
                >
                  {l.label}
                </Link>
              ))}
              {profile && (
                <Link
                  href="/me/edit"
                  className="mobile-nav-link"
                  onClick={() => setOpen(false)}
                >
                  ✏️ edit profile
                </Link>
              )}
              {onLogout && (
                <button
                  type="button"
                  className="mobile-nav-link mobile-nav-logout"
                  onClick={() => { setOpen(false); onLogout(); }}
                >
                  ↪ log out
                </button>
              )}
            </nav>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
