"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const STORAGE_NAME = "scrapbook:name";
const STORAGE_PHOTO = "scrapbook:photo";

const EXAMPLE_POLAROIDS = [
  { pos: "tl", seed: "scrapbook-goa-beach-2024",   tilt: -11, tape: "pink",   caption: "Goa ☀",        meta: "★★★★★" },
  { pos: "tr", seed: "scrapbook-tokyo-night-cafe", tilt: 9,   tape: "yellow", caption: "Tokyo lights",  meta: "★★★★☆" },
  { pos: "bl", seed: "scrapbook-paris-cafe-roma",  tilt: -7,  tape: "sage",   caption: "Cafe in Roma",  meta: "★★★★★" },
  { pos: "br", seed: "scrapbook-mountain-trek-12", tilt: 6,   tape: "peach",  caption: "Himalayan trek",meta: "★★★★☆" },
];

export default function Home() {
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    setName(localStorage.getItem(STORAGE_NAME) || "");
    setPhoto(localStorage.getItem(STORAGE_PHOTO) || "");
    setHydrated(true);
  }, []);

  function savePersonalization(newName, newPhoto) {
    setName(newName);
    setPhoto(newPhoto);
    if (newName) localStorage.setItem(STORAGE_NAME, newName);
    else localStorage.removeItem(STORAGE_NAME);
    if (newPhoto) localStorage.setItem(STORAGE_PHOTO, newPhoto);
    else localStorage.removeItem(STORAGE_PHOTO);
    setShowModal(false);
  }

  const personalized = hydrated && name && photo;
  const possessive = name ? `${name}${name.endsWith("s") ? "'" : "'s"}` : "your";

  return (
    <>
      <header className="nav nav-landing">
        <Link href="/" className="logo">scrapbook<span className="logo-dot">.</span></Link>
        <nav className="nav-links">
          <a href="#features" className="sticker sticker-pink">about</a>
          <Link href="/login" className="sticker sticker-yellow">log in</Link>
          <Link href="/signup" className="sticker sticker-sage">sign up →</Link>
        </nav>
      </header>

      <section className={`hero-spread ${personalized ? "hero-spread-bare" : ""}`}>

        {/* paper texture layers — hidden once the user has personalized */}
        {!personalized && <div className="hero-paper" />}

        {/* ransom note title, top-anchored */}
        <div className="hero-title-block">
          <p className="hero-kicker">welcome to</p>
          <p className="hero-possessive">{possessive}</p>
          <h1 className="title-ransom hero-title-ransom" aria-label="Scrapbook">
            {"Scrapbook".split("").map((letter, i) => (
              <span key={i} className={`ransom-letter ransom-${i}`}>{letter}</span>
            ))}
          </h1>
        </div>

        {/* example polaroids scattered around the spread */}
        {EXAMPLE_POLAROIDS.map((p, i) => (
          <ExamplePolaroid key={p.pos} {...p} delay={0.1 + i * 0.12} />
        ))}

        {/* center polaroid — user's photo or invite */}
        <motion.div
          className="hero-center"
          initial={{ opacity: 0, y: 40, rotate: 0, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, rotate: -3, scale: 1 }}
          transition={{ delay: 0.6, type: "spring", stiffness: 160, damping: 14 }}
        >
          {personalized ? (
            <div className="sway-wrapper">
              <UserPolaroid name={name} photo={photo} onEdit={() => setShowModal(true)} />
            </div>
          ) : (
            <InvitePolaroid onClick={() => setShowModal(true)} />
          )}
        </motion.div>

        {/* CTA — sticker style */}
        <motion.div
          className="hero-cta-row"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
        >
          <Link href="/signup" className="btn btn-primary hero-cta">
            start your scrapbook →
          </Link>
          <a href="#features" className="hero-howitworks">how it works ↓</a>
        </motion.div>

        {/* curated stickers and doodles */}
        <span className="hero-sticker hero-wax-1">♥</span>
        <span className="hero-sticker hero-stamp-1">
          <span className="stamp-heart">♥</span>
          <span className="stamp-label">love</span>
        </span>
        <span className="hero-sticker hero-stamp-2">
          <span className="stamp-heart">♥</span>
          <span className="stamp-label">&apos;26</span>
        </span>
        <span className="hero-sticker hero-star-1">★</span>
        <span className="hero-sticker hero-star-2">✦</span>
        <span className="hero-sticker hero-heart-1">♡</span>
        <span className="hero-sticker hero-paperclip">📎</span>
        <span className="hero-sticker hero-ribbon-1">
          <svg viewBox="0 0 60 40" width="60" height="40" aria-hidden="true">
            <path d="M5 20 Q15 5 25 20 Q35 35 5 20 Z" fill="#c93737" stroke="#7a1818" strokeWidth="1.5"/>
            <path d="M55 20 Q45 5 35 20 Q25 35 55 20 Z" fill="#c93737" stroke="#7a1818" strokeWidth="1.5"/>
            <circle cx="30" cy="20" r="5" fill="#7a1818"/>
          </svg>
        </span>

        {/* washi tape decorations */}
        <span className="hero-tape hero-tape-1" />
        <span className="hero-tape hero-tape-2" />
        <span className="hero-tape hero-tape-3" />
      </section>

      {/* what's inside — kept but less prominent */}
      <section className="features" id="features">
        <h2 className="section-title">what&apos;s inside <span className="squiggle">~</span></h2>
        <div className="polaroid-row">
          <article className="polaroid polaroid-1">
            <div className="polaroid-photo polaroid-photo-1"><span className="photo-emoji">📍</span></div>
            <p className="polaroid-caption">add places you&apos;ve been</p>
            <p className="polaroid-meta">★★★★★ + your review</p>
          </article>
          <article className="polaroid polaroid-2">
            <div className="polaroid-photo polaroid-photo-2"><span className="photo-emoji">🗺️</span></div>
            <p className="polaroid-caption">pin them on a map</p>
            <p className="polaroid-meta">build your to-do list of spots</p>
          </article>
          <article className="polaroid polaroid-3">
            <div className="polaroid-photo polaroid-photo-3"><span className="photo-emoji">👯</span></div>
            <p className="polaroid-caption">make groups with friends</p>
            <p className="polaroid-meta">share recs, plan trips together</p>
          </article>
        </div>
      </section>

      <footer className="footer">
        <p className="footer-note">made with washi tape &amp; love · scrapbook © 2026</p>
      </footer>

      <AnimatePresence>
        {showModal && (
          <PersonalizeModal
            initialName={name}
            initialPhoto={photo}
            onSave={savePersonalization}
            onClose={() => setShowModal(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function ExamplePolaroid({ pos, seed, tilt, tape, caption, meta, delay }) {
  return (
    <motion.div
      className={`hero-example hero-example-${pos}`}
      initial={{ opacity: 0, y: -40, rotate: 0, scale: 0.85 }}
      animate={{ opacity: 1, y: 0, rotate: tilt, scale: 1 }}
      transition={{ delay, type: "spring", stiffness: 140, damping: 14 }}
    >
      <span className={`example-tape example-tape-${tape}`} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://picsum.photos/seed/${seed}/420/420`}
        alt=""
        className="example-photo"
        loading="lazy"
      />
      <p className="example-caption">{caption}</p>
      <p className="example-meta">{meta}</p>
    </motion.div>
  );
}

function UserPolaroid({ name, photo, onEdit }) {
  return (
    <div className="center-polaroid">
      <span className="center-tape" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo} alt={name} className="center-photo" />
      <p className="center-caption">{name} ♡</p>
      <button className="center-edit" onClick={onEdit}>edit</button>
    </div>
  );
}

function InvitePolaroid({ onClick }) {
  return (
    <button className="center-polaroid invite-polaroid" onClick={onClick}>
      <span className="center-tape" />
      <div className="invite-frame">
        <span className="invite-plus">+</span>
        <p className="invite-text">tape in your<br/>photo &amp; name</p>
      </div>
    </button>
  );
}

function PersonalizeModal({ initialName, initialPhoto, onSave, onClose }) {
  const [name, setName] = useState(initialName || "");
  const [photo, setPhoto] = useState(initialPhoto || "");
  const [busy, setBusy] = useState(false);

  async function pickPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    const dataUrl = await resize(file, 720);
    setPhoto(dataUrl);
    setBusy(false);
  }

  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="modal-card"
        initial={{ y: 40, opacity: 0, rotate: -3, scale: 0.92 }}
        animate={{ y: 0, opacity: 1, rotate: -1, scale: 1 }}
        exit={{ y: 40, opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 200, damping: 18 }}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="modal-tape" />
        <h2 className="modal-title">make it yours</h2>
        <p className="modal-sub">your name + face go right onto the front page</p>

        <label className="auth-label">your name</label>
        <input
          className="auth-input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Ananya"
          maxLength={30}
        />

        <label className="auth-label">your photo</label>
        <label htmlFor="modal-photo" className="upload-file-btn upload-file-btn-wide">
          {photo ? "✓ change photo" : "📷 pick a photo"}
        </label>
        <input id="modal-photo" type="file" accept="image/*" onChange={pickPhoto} className="upload-file-input" />

        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="modal-preview" />
        )}

        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!name || !photo || busy}
            onClick={() => onSave(name.trim(), photo)}
          >
            {busy ? "preparing…" : "tape it on →"}
          </button>
          {(initialName || initialPhoto) && (
            <button type="button" className="upload-clear-btn" onClick={() => onSave("", "")}>
              clear everything
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

async function resize(file, maxWidth) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
