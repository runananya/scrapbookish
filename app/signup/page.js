"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState({ text: "", type: "" });
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg({ text: "", type: "" });

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name } },
    });

    if (error) {
      setMsg({ text: error.message, type: "error" });
      setBusy(false);
      return;
    }

    if (data.session) {
      setMsg({ text: "scrapbook made! taking you in…", type: "success" });
      router.push("/scrapbook");
    } else {
      setMsg({
        text: "check your email to confirm your account, then come back and log in!",
        type: "success",
      });
      setBusy(false);
    }
  }

  return (
    <>
      <span className="tape tape-2" />
      <span className="doodle-star doodle-star-1">✦</span>

      <header className="nav">
        <Link href="/" className="logo">scrapbook<span className="logo-dot">.</span></Link>
        <nav className="nav-links">
          <Link href="/login" className="sticker sticker-yellow">log in</Link>
        </nav>
      </header>

      <main className="auth-wrap">
        <h1 className="auth-title">make a scrapbook</h1>
        <p className="auth-sub">start collecting places, reviews & friends</p>

        <form onSubmit={onSubmit}>
          <label className="auth-label" htmlFor="name">what should we call you?</label>
          <input
            id="name"
            className="auth-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="your name"
            required
          />

          <label className="auth-label" htmlFor="email">email</label>
          <input
            id="email"
            className="auth-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />

          <label className="auth-label" htmlFor="password">pick a password</label>
          <input
            id="password"
            className="auth-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="at least 6 characters"
            minLength={6}
            required
          />

          <div className="auth-row">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "making your book…" : "make my scrapbook →"}
            </button>
          </div>

          {msg.text && <p className={`auth-msg ${msg.type}`}>{msg.text}</p>}
        </form>

        <p className="auth-switch">
          already have one? <Link href="/login">log in →</Link>
        </p>
      </main>
    </>
  );
}
