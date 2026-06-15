"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState({ text: "", type: "" });
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg({ text: "", type: "" });

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setMsg({ text: error.message, type: "error" });
      setBusy(false);
      return;
    }

    setMsg({ text: "logged in! redirecting…", type: "success" });
    router.push("/scrapbook");
  }

  return (
    <>
      <span className="tape tape-1" />
      <span className="doodle-star doodle-star-2">★</span>

      <header className="nav">
        <Link href="/" className="logo">scrapbook<span className="logo-dot">.</span></Link>
        <nav className="nav-links">
          <Link href="/signup" className="sticker sticker-sage">sign up →</Link>
        </nav>
      </header>

      <main className="auth-wrap">
        <h1 className="auth-title">welcome back</h1>
        <p className="auth-sub">log in to your scrapbook</p>

        <form onSubmit={onSubmit}>
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

          <label className="auth-label" htmlFor="password">password</label>
          <input
            id="password"
            className="auth-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />

          <div className="auth-row">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "logging in…" : "log in →"}
            </button>
          </div>

          {msg.text && <p className={`auth-msg ${msg.type}`}>{msg.text}</p>}
        </form>

        <p className="auth-switch">
          new here? <Link href="/signup">make a scrapbook →</Link>
        </p>
      </main>
    </>
  );
}
