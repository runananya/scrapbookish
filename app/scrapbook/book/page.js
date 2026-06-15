"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const MemoriesBook = dynamic(() => import("@/components/MemoriesBook"), { ssr: false });

export default function BookPage() {
  const router = useRouter();
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      const { data } = await supabase
        .from("places")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      setPlaces(data || []);
      setLoading(false);
    })();
  }, [router]);

  if (loading) return <main className="auth-wrap"><p className="auth-sub">opening the book…</p></main>;

  return (
    <div className="book-page">
      <header className="nav nav-book">
        <Link href="/" className="logo">scrapbook<span className="logo-dot">.</span></Link>
        <nav className="nav-links">
          <Link href="/scrapbook" className="sticker sticker-pink">← memory box</Link>
        </nav>
      </header>

      {places.length === 0 ? (
        <div className="empty-state" style={{ paddingTop: 80 }}>
          <p className="empty-emoji">📖</p>
          <p className="empty-title">the book is empty</p>
          <p className="empty-sub">tape in a memory first, then come open the book</p>
          <Link href="/scrapbook/add" className="btn btn-primary">+ add a memory</Link>
        </div>
      ) : (
        <MemoriesBook places={places} />
      )}

      <p className="book-hint">click the book (or use the buttons) to turn the page · drag to rotate</p>
    </div>
  );
}
