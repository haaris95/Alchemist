"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { boardStore, createBlankBoard } from "@/lib/board";
import { useCurrentMember } from "@/hooks/use-current-member";
import { isSupabaseConfigured } from "@/lib/supabase/client";

type BoardSummary = { id: string; title: string; updated_at: string; ai_autonomy: boolean };

export default function Dashboard() {
  const router = useRouter();
  const { member, loading, authenticated } = useCurrentMember();
  const [title, setTitle] = useState("");
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured() || loading) return;
    if (!authenticated) {
      router.replace("/login?next=new");
      return;
    }
    void (async () => {
      const response = await fetch("/api/boards", { cache: "no-store" });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string" ? (body as { error: string }).error : "Could not load your sessions.");
        return;
      }
      setBoards(body && typeof body === "object" && Array.isArray((body as { boards?: unknown }).boards) ? (body as { boards: BoardSummary[] }).boards : []);
    })();
  }, [authenticated, loading, router]);

  async function createSession(event: FormEvent) {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    setCreating(true);
    setError(null);
    try {
      if (!isSupabaseConfigured()) {
        boardStore.createSession(cleanTitle, member.id);
        router.push("/workspace");
        return;
      }
      const document = createBlankBoard(cleanTitle, member);
      const response = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: cleanTitle, document }),
      });
      const body: unknown = await response.json().catch(() => null);
      const boardId = body && typeof body === "object" ? (body as { board?: { id?: unknown } }).board?.id : null;
      if (!response.ok || typeof boardId !== "string") throw new Error(body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string" ? (body as { error: string }).error : "Could not create the session.");
      router.push(`/workspace/${boardId}`);
    } catch (creationError) {
      setError(creationError instanceof Error ? creationError.message : "Could not create the session.");
    } finally {
      setCreating(false);
    }
  }

  return <main className="dashboard-shell">
    <header className="marketing-nav dashboard-nav"><Link className="brand" href="/"><span className="brand-spark">✦</span><span>AIchemist<small>Your AI teammate in the room</small></span></Link><div><Link className="nav-login" href="/">Home</Link><span className="dashboard-person">{member.initials} {member.name}</span></div></header>
    <section className="dashboard-hero"><p className="landing-kicker"><i>✦</i> YOUR WORKSPACES</p><h1>Begin with a question.<br /><em>Let the room get interesting.</em></h1><p>Every new session starts as your own blank canvas. AIchemist can introduce an original angle, test assumptions, and disagree when the thinking needs pressure.</p></section>
    <section className="session-create-card"><div><p className="eyebrow">NEW BRAINSTORM</p><h2>What should this room explore?</h2></div><form onSubmit={createSession}><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. How might we redesign onboarding?" autoFocus /><button type="submit" disabled={creating || loading}>{creating ? "Creating…" : "Create blank session →"}</button></form><small>{isSupabaseConfigured() ? "This session will be private to you until you share it." : "Local preview mode — add Supabase keys to save and share this session."}</small>{error && <p className="dashboard-error">{error}</p>}</section>
    <section className="session-list"><div className="section-heading"><div><p className="eyebrow">RECENT ROOMS</p><h2>Your sessions</h2></div><span>{boards.length}</span></div>{isSupabaseConfigured() && !loading && boards.length === 0 ? <p className="session-empty">No saved sessions yet. Start with the question above.</p> : <div className="session-grid">{boards.map((board) => <Link href={`/workspace/${board.id}`} className="session-card" key={board.id}><span>✦</span><p>{board.ai_autonomy ? "AI teammate enabled" : "AI teammate on request"}</p><h3>{board.title}</h3><small>Updated {new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(board.updated_at))}</small></Link>)}</div>}</section>
  </main>;
}
