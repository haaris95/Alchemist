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
  const [description, setDescription] = useState("");
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
    const cleanDescription = description.trim();
    if (!cleanTitle) return;
    setCreating(true);
    setError(null);
    try {
      if (!isSupabaseConfigured()) {
        boardStore.createSession(cleanTitle, member.id, cleanDescription);
        router.push("/workspace");
        return;
      }
      const document = createBlankBoard(cleanTitle, member, cleanDescription);
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
    <section className="dashboard-hero"><p className="landing-kicker"><i>✦</i> YOUR WORKSPACES</p><h1>Begin with a question.<br /><em>Give the room a little context.</em></h1><p>AIchemist starts by responding to your brief. It waits for real human thinking before introducing its own direction or a strong objection.</p></section>
    <section className="session-create-card"><div><p className="eyebrow">NEW BRAINSTORM</p><h2>What should this room explore?</h2></div><form onSubmit={createSession}><label>Session question<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. How might we redesign onboarding?" autoFocus /></label><label>Context for AIchemist <small>Optional, but recommended</small><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What are you trying to decide, who is involved, and what constraints or outcomes matter?" maxLength={900} /></label><button type="submit" disabled={creating || loading}>{creating ? "Creating…" : "Create blank session →"}</button></form><small>{isSupabaseConfigured() ? "This session will be private to you until you share it. A clear brief gets AIchemist's first feedback grounded in your goal." : "Local preview mode — add Supabase keys to save and share this session."}</small>{error && <p className="dashboard-error">{error}</p>}</section>
    <section className="session-list"><div className="section-heading"><div><p className="eyebrow">RECENT ROOMS</p><h2>Your sessions</h2></div><span>{boards.length}</span></div>{isSupabaseConfigured() && !loading && boards.length === 0 ? <p className="session-empty">No saved sessions yet. Start with the question above.</p> : <div className="session-grid">{boards.map((board) => <Link href={`/workspace/${board.id}`} className="session-card" key={board.id}><span>✦</span><p>{board.ai_autonomy ? "AI teammate enabled" : "AI teammate on request"}</p><h3>{board.title}</h3><small>Updated {new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(board.updated_at))}</small></Link>)}</div>}</section>
  </main>;
}
