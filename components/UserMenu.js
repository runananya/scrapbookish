"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Avatar from "./Avatar";

export default function UserMenu({ profile, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    function onEsc(e) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", onClickOutside);
      document.addEventListener("keydown", onEsc);
    }
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div className="user-menu" ref={ref}>
      <button
        type="button"
        className="user-menu-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-label="profile menu"
      >
        <Avatar profile={profile} size={40} />
      </button>
      {open && (
        <div className="user-menu-dropdown" role="menu">
          <div className="user-menu-header">
            <Avatar profile={profile} size={48} />
            <div>
              <p className="user-menu-name">{profile?.display_name || "you"}</p>
              <p className="user-menu-sub">your scrapbook</p>
            </div>
          </div>
          <Link href="/me/edit" className="user-menu-item" onClick={() => setOpen(false)}>
            ✏️ edit profile
          </Link>
          <button
            type="button"
            className="user-menu-item user-menu-logout"
            onClick={() => { setOpen(false); onLogout(); }}
          >
            ↪ log out
          </button>
        </div>
      )}
    </div>
  );
}
