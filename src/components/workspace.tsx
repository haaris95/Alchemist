"use client";

import Link from "next/link";
import { FormEvent, PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { boardStore, type BoardConnection, type BoardNote, type BoardStroke, type MemberId, type StickyColor } from "@/lib/board";
import { useBoard } from "@/hooks/use-board";
import { useWebMCPTools } from "@/hooks/use-webmcp-tools";
import { useBoardPersistence } from "@/hooks/use-board-persistence";
import { useCurrentMember } from "@/hooks/use-current-member";

type CanvasTool = "select" | "draw" | "connector";
type GroqContribution = {
  text: string;
  color: StickyColor;
  connectToNoteId: string;
  connectionLabel: string;
  strokes: Array<{ points: Array<{ x: number; y: number }>; color: string; width: number }>;
};
type PitchIntent = "feedback" | "independent" | "challenge" | "sketch";

const STICKY_COLORS: StickyColor[] = ["sun", "rose", "mint", "lavender"];
const SESSION_BRIEF_MIN_LENGTH = 24;

function humanIdeaCount(notes: BoardNote[]) {
  return notes.filter((note) => note.authorId !== "aichemist").length;
}

function hasUsefulSessionBrief(description: string) {
  return description.trim().length >= SESSION_BRIEF_MIN_LENGTH;
}

function isGroqStroke(value: unknown): value is GroqContribution["strokes"][number] {
  if (!value || typeof value !== "object") return false;
  const stroke = value as Record<string, unknown>;
  return Array.isArray(stroke.points)
    && stroke.points.length >= 2
    && stroke.points.every((point) => point && typeof point === "object" && typeof (point as Record<string, unknown>).x === "number" && typeof (point as Record<string, unknown>).y === "number")
    && typeof stroke.color === "string"
    && typeof stroke.width === "number";
}

function isGroqContribution(value: unknown): value is GroqContribution {
  if (!value || typeof value !== "object") return false;
  const contribution = value as Record<string, unknown>;
  return typeof contribution.text === "string"
    && STICKY_COLORS.includes(contribution.color as StickyColor)
    && typeof contribution.connectToNoteId === "string"
    && typeof contribution.connectionLabel === "string"
    && Array.isArray(contribution.strokes)
    && contribution.strokes.every(isGroqStroke);
}

async function getGroqContribution(signal: AbortSignal, intent: PitchIntent) {
  const response = await fetch("/api/ai/pitch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ board: boardStore.boardForAgent(), intent }),
    signal,
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string"
      ? (body as { error: string }).error
      : "AIchemist could not reach Groq right now.";
    throw new Error(message);
  }
  const contribution = body && typeof body === "object" ? (body as { contribution?: unknown }).contribution : null;
  if (!isGroqContribution(contribution)) throw new Error("Groq returned an invalid board contribution.");
  return contribution;
}

function curveFor(from: BoardNote, to: BoardNote) {
  const x1 = from.x + 120; const y1 = from.y + 85; const x2 = to.x + 120; const y2 = to.y + 85;
  const bend = Math.max(86, Math.abs(x2 - x1) * 0.42);
  return { d: `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`, x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
}

function strokePath(stroke: Pick<BoardStroke, "points">) {
  return stroke.points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

export default function Workspace({ boardId }: { boardId?: string }) {
  const router = useRouter();
  const board = useBoard();
  const { member: currentMember } = useCurrentMember();
  const { status: syncStatus, error: syncError, isPersistent, isReady } = useBoardPersistence(boardId);
  const [newIdea, setNewIdea] = useState("");
  const [newIdeaColor, setNewIdeaColor] = useState<StickyColor>("sun");
  const [comment, setComment] = useState("");
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [mcpStatus, setMcpStatus] = useState<"checking" | "ready" | "unavailable">("checking");
  const [canvasTool, setCanvasTool] = useState<CanvasTool>("select");
  const [connectionStartId, setConnectionStartId] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showNewSession, setShowNewSession] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [sessionName, setSessionName] = useState("");
  const [sessionDescription, setSessionDescription] = useState("");
  const [activeStroke, setActiveStroke] = useState<Array<{ x: number; y: number }>>([]);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ noteId: string; offsetX: number; offsetY: number } | null>(null);
  const strokeRef = useRef<Array<{ x: number; y: number }> | null>(null);
  const autoPitchActivityIdRef = useRef<string | null>(null);
  const blankRoomPitchIdRef = useRef<string | null>(null);
  const autonomousCycleRef = useRef(0);
  const selectedNote = board.notes.find((note) => note.id === selectedNoteId) ?? null;
  const autoPitch = board.aiAutonomy;

  useEffect(() => {
    if (isPersistent) return;
    boardStore.hydrate();
    try {
      const localMember = window.localStorage.getItem("aichemist-member");
      if (localMember) boardStore.setCurrentUser((JSON.parse(localMember) as { name?: string }).name ?? "");
    } catch { /* Local profile is optional. */ }
    const showNewSessionFrame = window.requestAnimationFrame(() => {
      if (window.location.search.includes("new=1")) setShowNewSession(true);
    });
    return () => window.cancelAnimationFrame(showNewSessionFrame);
  }, [isPersistent]);

  useEffect(() => {
    if (!isReady) return;
    boardStore.setCurrentUser(currentMember.name, currentMember.id);
  }, [currentMember, isReady]);

  const performPitchIn = useCallback(async (signal: AbortSignal, intent: PitchIntent = "independent") => {
    boardStore.setAiStatus("thinking");
    try {
      setAiError(null);
      const contribution = await getGroqContribution(signal, intent);
      if (signal.aborted) throw new DOMException("Tool call cancelled", "AbortError");
      const result = boardStore.createNote({ text: contribution.text, color: contribution.color, authorId: "aichemist" });
      const targetExists = boardStore.getSnapshot().notes.some((note) => note.id === contribution.connectToNoteId && note.id !== result.note.id);
      const connection = targetExists
        ? boardStore.createConnection({ fromId: contribution.connectToNoteId, toId: result.note.id, label: contribution.connectionLabel, authorId: "aichemist" })
        : null;
      const strokes = contribution.strokes.map((stroke) => boardStore.addStroke({ ...stroke, authorId: "aichemist" }));
      setSelectedNoteId(result.note.id);
      return { note: result.note, connection: connection?.connection, strokes, insight: contribution.strokes.length ? "AIchemist contributed a visual sketch through Groq." : "AIchemist contributed through Groq." };
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setAiError(error instanceof Error ? error.message : "AIchemist could not reach Groq right now.");
      }
      throw error;
    } finally { boardStore.setAiStatus("active"); }
  }, []);

  useEffect(() => {
    const latestActivity = board.activity[0];
    const humanNotes = humanIdeaCount(board.notes);
    if (!isReady || !autoPitch || board.aiStatus === "thinking" || humanNotes === 0 || !latestActivity || latestActivity.actorId === "aichemist" || autoPitchActivityIdRef.current === latestActivity.id) return;
    const intent: PitchIntent = humanNotes < 2 ? "feedback" : humanNotes % 3 === 0 ? "challenge" : "independent";
    const timer = window.setTimeout(() => {
      if (autoPitchActivityIdRef.current === latestActivity.id) return;
      autoPitchActivityIdRef.current = latestActivity.id;
      void performPitchIn(new AbortController().signal, intent).catch(() => undefined);
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [autoPitch, board.activity, board.aiStatus, board.notes, isReady, performPitchIn]);

  useEffect(() => {
    const sessionActivity = board.activity[0];
    const hasBrief = hasUsefulSessionBrief(board.description);
    if (!isReady || !autoPitch || !hasBrief || board.aiStatus === "thinking" || humanIdeaCount(board.notes) !== 0 || !sessionActivity || sessionActivity.actorId === "aichemist" || blankRoomPitchIdRef.current === sessionActivity.id) return;
    const timer = window.setTimeout(() => {
      const snapshot = boardStore.getSnapshot();
      if (blankRoomPitchIdRef.current === sessionActivity.id || humanIdeaCount(snapshot.notes) !== 0 || !hasUsefulSessionBrief(snapshot.description)) return;
      blankRoomPitchIdRef.current = sessionActivity.id;
      void performPitchIn(new AbortController().signal, "feedback").catch(() => undefined);
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [autoPitch, board.activity, board.aiStatus, board.description, board.notes, isReady, performPitchIn]);

  useEffect(() => {
    if (!isReady || !autoPitch) return;
    const timer = window.setInterval(() => {
      const snapshot = boardStore.getSnapshot();
      if (snapshot.aiStatus === "thinking" || humanIdeaCount(snapshot.notes) < 2) return;
      const cycle: PitchIntent[] = ["independent", "challenge", "independent"];
      const intent = cycle[autonomousCycleRef.current % cycle.length];
      autonomousCycleRef.current += 1;
      void performPitchIn(new AbortController().signal, intent).catch(() => undefined);
    }, 120_000);
    return () => window.clearInterval(timer);
  }, [autoPitch, isReady, performPitchIn]);

  const onCreateNote = useCallback((input: { text: string; color?: StickyColor; x?: number; y?: number }) => {
    const result = boardStore.createNote({ ...input, authorId: "aichemist", color: input.color ?? "lavender" });
    setSelectedNoteId(result.note.id); return result;
  }, []);
  const onCreateSession = useCallback((input: { title: string; description?: string }) => {
    boardStore.createSession(input.title, "aichemist", input.description);
    setSelectedNoteId(null);
    return boardStore.boardForAgent();
  }, []);
  const onMoveNote = useCallback((input: { noteId: string; x: number; y: number }) => boardStore.moveNote(input.noteId, input.x, input.y), []);
  const onUpdateNote = useCallback((input: { noteId: string; text?: string; color?: StickyColor }) => boardStore.updateNote({ ...input, authorId: "aichemist" }), []);
  const onDeleteNote = useCallback((input: { noteId: string }) => {
    const result = boardStore.deleteNote(input.noteId, "aichemist");
    setSelectedNoteId((current) => current === input.noteId ? null : current);
    return result;
  }, []);
  const onAddComment = useCallback((input: { noteId: string; text: string }) => boardStore.addComment(input.noteId, input.text, "aichemist"), []);
  const onCreateConnection = useCallback((input: { fromId: string; toId: string; label?: string }) => boardStore.createConnection({ ...input, authorId: "aichemist" }), []);
  const onUpdateConnection = useCallback((input: { connectionId: string; label?: string }) => boardStore.updateConnection({ ...input, authorId: "aichemist" }), []);
  const onDeleteConnection = useCallback((input: { connectionId: string }) => boardStore.deleteConnection(input.connectionId, "aichemist"), []);
  const onDrawStroke = useCallback((input: { points: Array<{ x: number; y: number }>; color?: string; width?: number }) => boardStore.addStroke({ ...input, authorId: "aichemist" }), []);
  const onGetBoard = useCallback(() => boardStore.boardForAgent(), []);
  const onStatus = useCallback((status: "ready" | "unavailable") => setMcpStatus(status), []);
  const onPitchIn = useCallback((signal: AbortSignal) => {
    const snapshot = boardStore.getSnapshot();
    const humanNotes = humanIdeaCount(snapshot.notes);
    if (humanNotes === 0 && !hasUsefulSessionBrief(snapshot.description)) {
      return Promise.reject(new Error("Add a session brief or a first human idea before asking AIchemist to pitch in."));
    }
    return performPitchIn(signal, humanNotes < 2 ? "feedback" : "independent");
  }, [performPitchIn]);
  useWebMCPTools({
    onGetBoard, onCreateSession, onCreateNote, onMoveNote, onUpdateNote, onDeleteNote, onAddComment,
    onCreateConnection, onUpdateConnection, onDeleteConnection, onDrawStroke, onPitchIn, onStatus,
  });

  function addHumanIdea(event: FormEvent) {
    event.preventDefault(); if (!newIdea.trim()) return;
    const result = boardStore.createNote({ text: newIdea, authorId: currentMember.id, color: newIdeaColor });
    setNewIdea(""); setSelectedNoteId(result.note.id);
  }
  function addComment(event: FormEvent) {
    event.preventDefault(); if (!selectedNote || !comment.trim()) return;
    boardStore.addComment(selectedNote.id, comment, currentMember.id); setComment("");
  }
  function createSession(event: FormEvent) {
    event.preventDefault(); if (!sessionName.trim()) return;
    if (isPersistent) { router.push("/dashboard?new=1"); return; }
    boardStore.createSession(sessionName, currentMember.id, sessionDescription); setSelectedNoteId(null); setSessionName(""); setSessionDescription(""); setShowNewSession(false); window.history.replaceState({}, "", "/workspace");
  }
  function requestAiInput(request: "challenge" | "sketch" = "challenge") {
    const humanNotes = humanIdeaCount(board.notes);
    if (humanNotes === 0 && !hasUsefulSessionBrief(board.description)) {
      setAiError("Add a session brief or your first idea so AIchemist has real context to respond to.");
      return;
    }
    const intent: PitchIntent = request === "sketch" ? "sketch" : humanNotes < 2 ? "feedback" : "challenge";
    void performPitchIn(new AbortController().signal, intent).catch(() => undefined);
  }
  function beginDrag(event: PointerEvent<HTMLButtonElement>, note: BoardNote) {
    if (canvasTool === "connector") {
      event.preventDefault(); setSelectedNoteId(note.id);
      if (connectionStartId && connectionStartId !== note.id) { boardStore.createConnection({ fromId: connectionStartId, toId: note.id, label: "related", authorId: currentMember.id }); setConnectionStartId(null); setCanvasTool("select"); }
      else setConnectionStartId(note.id);
      return;
    }
    if (canvasTool !== "select" || event.button !== 0 || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    dragRef.current = { noteId: note.id, offsetX: (event.clientX - rect.left) / zoom - note.x, offsetY: (event.clientY - rect.top) / zoom - note.y };
    event.currentTarget.setPointerCapture(event.pointerId); setSelectedNoteId(note.id);
  }
  function dragNote(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current; const rect = canvasRef.current?.getBoundingClientRect();
    if (!drag || !rect) return;
    boardStore.moveNote(drag.noteId, (event.clientX - rect.left) / zoom - drag.offsetX, (event.clientY - rect.top) / zoom - drag.offsetY);
  }
  function stopDrag() { dragRef.current = null; }
  function canvasPoint(event: PointerEvent<SVGSVGElement>) {
    const rect = canvasRef.current?.getBoundingClientRect();
    return rect ? { x: (event.clientX - rect.left) / zoom, y: (event.clientY - rect.top) / zoom } : null;
  }
  function beginDrawing(event: PointerEvent<SVGSVGElement>) {
    if (canvasTool !== "draw") return; const point = canvasPoint(event); if (!point) return;
    strokeRef.current = [point]; setActiveStroke([point]); event.currentTarget.setPointerCapture(event.pointerId);
  }
  function continueDrawing(event: PointerEvent<SVGSVGElement>) {
    if (!strokeRef.current) return; const point = canvasPoint(event); if (!point) return;
    strokeRef.current = [...strokeRef.current, point]; setActiveStroke(strokeRef.current);
  }
  function finishDrawing() {
    if (strokeRef.current && strokeRef.current.length > 1) boardStore.addStroke({ points: strokeRef.current, authorId: currentMember.id });
    strokeRef.current = null; setActiveStroke([]);
  }
  const memberFor = (memberId: MemberId) => board.members.find((member) => member.id === memberId) ?? board.members[0];
  const connectionFor = (connection: BoardConnection) => { const from = board.notes.find((note) => note.id === connection.fromId); const to = board.notes.find((note) => note.id === connection.toId); return from && to ? { from, to, ...curveFor(from, to) } : null; };

  async function createShareLink() {
    if (!boardId) { setShareError("Create a saved session before sharing it."); return; }
    setShareError(null);
    try {
      const response = await fetch(`/api/boards/${boardId}/invite`, { method: "POST" });
      const body: unknown = await response.json().catch(() => null);
      const token = body && typeof body === "object" ? (body as { token?: unknown }).token : null;
      if (!response.ok || typeof token !== "string") throw new Error(body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string" ? (body as { error: string }).error : "Could not create a share link.");
      const link = `${window.location.origin}/join/${token}`;
      setShareLink(link);
      await navigator.clipboard?.writeText(link);
    } catch (shareError) { setShareError(shareError instanceof Error ? shareError.message : "Could not create a share link."); }
  }

  if (isPersistent && !isReady) {
    return <main className="app-shell board-loading"><section><span className="session-orb">✦</span><p className="landing-kicker">SAVED SESSION</p><h1>{syncStatus === "error" ? "This board could not be opened." : "Opening your board…"}</h1><p>{syncError ?? "Loading the correct shared canvas, members, and activity trail."}</p><Link href="/dashboard">← Back to your sessions</Link></section></main>;
  }

  return <main className="app-shell">
    <header className="topbar"><Link className="brand" href="/"><span className="brand-spark">✦</span><span>AIchemist<small>Your AI teammate in the room</small></span></Link><div className="project-crumb"><span className="crumb-dot"></span><span>Workspaces</span><b>/</b><strong>{isPersistent ? "Saved session" : "Local preview"}</strong><b>/</b><em>{syncStatus === "synced" ? "Synced" : syncStatus === "saving" ? "Saving" : "Brainstorm"}</em></div><div className="topbar-actions"><span className={`mcp-pill mcp-pill--${mcpStatus}`}><i></i>{mcpStatus === "ready" ? "WebMCP live" : mcpStatus === "checking" ? "Checking WebMCP" : "WebMCP-ready"}</span><button className="avatar-stack" aria-label={`${board.members.length} members in this session`}>{board.members.slice(0, 3).map((member) => <span className={member.id === "aichemist" ? "avatar-ai" : ""} key={member.id}>{member.initials}</span>)}</button><button className="share-button" onClick={() => { setShowShare(true); setShareError(null); }} disabled={!isPersistent}>Share</button></div></header>
    <section className="project-header"><div><p className="eyebrow">BRAINSTORMING SESSION <span>•</span> LIVE NOW</p><h1>{board.title}</h1><p className="project-subtitle">{board.description || "Add a short session brief or your first idea; AIchemist will respond once it has context."}</p></div><div className="project-meta"><span><b>{board.notes.length}</b> ideas</span><span><b>{board.connections.length}</b> connections</span><button onClick={() => isPersistent ? router.push("/dashboard?new=1") : setShowNewSession(true)}>+ New session</button>{!isPersistent && <button onClick={() => boardStore.reset()}>Load demo</button>}</div></section>
    <section className="workspace" id="board"><div className="board-column">
      <form className="idea-composer" onSubmit={addHumanIdea}><div className="composer-avatar">{memberFor(currentMember.id).initials}</div><input value={newIdea} onChange={(event) => setNewIdea(event.target.value)} placeholder="Add your thinking to the board…" aria-label="Add a sticky note" /><div className="color-picker" aria-label="Sticky note color">{STICKY_COLORS.map((color) => <button type="button" key={color} className={`color-dot color-dot--${color} ${newIdeaColor === color ? "is-selected" : ""}`} onClick={() => setNewIdeaColor(color)} aria-label={`Use ${color} sticky note`} />)}</div><button className="add-idea" type="submit">Add idea <span>↵</span></button></form>
      <div className="canvas-card"><div className="canvas-toolbar"><div><span className="live-dot"></span><strong>Live canvas</strong><small>{canvasTool === "draw" ? "Sketch freely on the board" : canvasTool === "connector" ? connectionStartId ? "Choose another note to connect" : "Choose the first note to connect" : "Drag ideas to make space"}</small></div><div className="canvas-mode-tools"><button className={canvasTool === "select" ? "is-active" : ""} onClick={() => { setCanvasTool("select"); setConnectionStartId(null); }} aria-label="Select and move">↖ <span>Select</span></button><button className={canvasTool === "draw" ? "is-active" : ""} onClick={() => { setCanvasTool("draw"); setConnectionStartId(null); }} aria-label="Draw on canvas">〰 <span>Draw</span></button><button className={canvasTool === "connector" ? "is-active" : ""} onClick={() => setCanvasTool("connector")} aria-label="Connect ideas">⌁ <span>Connect</span></button></div><div className="canvas-tools"><button onClick={() => setZoom((value) => Math.max(0.76, Number((value - 0.1).toFixed(2))))} aria-label="Zoom out">−</button><span>{Math.round(zoom * 100)}%</span><button onClick={() => setZoom((value) => Math.min(1.15, Number((value + 0.1).toFixed(2))))} aria-label="Zoom in">+</button><button className="fit-button" onClick={() => setZoom(1)}>Fit</button></div></div>
        <div className="canvas-viewport"><div className="canvas-scene" ref={canvasRef} style={{ transform: `scale(${zoom})` }} onPointerMove={dragNote} onPointerUp={stopDrag} onPointerCancel={stopDrag}>{board.clusters.map((cluster) => <div className="cluster" key={cluster.id} style={{ left: cluster.x, top: cluster.y, width: cluster.width, height: cluster.height }}><span>{cluster.label}</span></div>)}<svg className="connections" viewBox="0 0 1100 680" aria-hidden="true"><defs><marker id="arrowhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker></defs>{board.connections.map((connection) => { const line = connectionFor(connection); return line ? <g key={connection.id} className={connection.authorId === "aichemist" ? "connection connection--ai" : "connection"}><path d={line.d} markerEnd="url(#arrowhead)" /><text x={line.x} y={line.y - 10}>{connection.label}</text></g> : null; })}</svg>{board.notes.map((note) => { const author = memberFor(note.authorId); return <button key={note.id} className={`sticky sticky--${note.color} ${note.authorId === "aichemist" ? "sticky--ai" : ""} ${note.id === selectedNoteId ? "sticky--selected" : ""} ${connectionStartId === note.id ? "sticky--connection-origin" : ""}`} style={{ left: note.x, top: note.y }} onPointerDown={(event) => beginDrag(event, note)} onClick={() => setSelectedNoteId(note.id)}><span className="sticky-author"><i style={{ background: author.color }}>{author.initials}</i>{author.name}</span><strong>{note.text}</strong><span className="sticky-footer"><small>{note.createdAt}</small>{note.comments.length > 0 && <em>◌ {note.comments.length}</em>}</span></button>; })}<svg className={`drawing-layer ${canvasTool === "draw" ? "drawing-layer--active" : ""}`} viewBox="0 0 1100 680" onPointerDown={beginDrawing} onPointerMove={continueDrawing} onPointerUp={finishDrawing} onPointerCancel={finishDrawing}>{board.strokes.map((stroke) => <path key={stroke.id} d={strokePath(stroke)} stroke={stroke.color} strokeWidth={stroke.width} />)}{activeStroke.length > 1 && <path d={strokePath({ points: activeStroke })} stroke="#45405b" strokeWidth="3" />}</svg>{board.aiStatus === "thinking" && <div className="ai-cursor"><span>✦</span><p>AIchemist is thinking…</p></div>}</div></div>
      <div className="canvas-footer"><span><i className="human-key"></i> Human idea</span><span><i className="ai-key"></i> AIchemist contribution</span><span><i className="line-key"></i> Connected thinking</span><span><i className="draw-key"></i> Sketch</span><p>{canvasTool === "connector" ? "Click two notes to create a relationship." : "Select a tool, then work directly on the canvas."}</p></div></div>
    </div><aside className="sidebar"><section className={`ai-presence ${board.aiStatus === "thinking" ? "ai-presence--thinking" : ""}`}><div className="ai-presence-head"><span className="ai-orb">✦</span><div><strong>AIchemist</strong><p>{board.aiStatus === "thinking" ? "Thinking with the board" : autoPitch ? "Autonomous Groq teammate" : "Available on request"}</p></div><span className="presence-status">{board.aiStatus === "thinking" ? "WORKING" : autoPitch ? "AUTO" : "ACTIVE"}</span></div><p className="ai-presence-copy">{board.aiStatus === "thinking" ? "Looking for a missing criterion, assumption, or strong challenge." : autoPitch ? "I’ll first respond to your brief. Once the room has at least two human ideas, I’ll independently add directions and challenge assumptions." : "I’ll wait for you to invite me into the conversation."}</p><label className="autopilot-switch"><span><i>✦</i> Let AIchemist pitch in autonomously</span><input type="checkbox" checked={autoPitch} onChange={(event) => boardStore.setAiAutonomy(event.target.checked)} /><b></b></label><button className="pitch-button" disabled={board.aiStatus === "thinking"} onClick={() => requestAiInput()}>{board.aiStatus === "thinking" ? <><span className="thinking-ring"></span> Thinking…</> : humanIdeaCount(board.notes) < 2 ? <><span>✦</span> Ask AIchemist for feedback</> : <><span>✦</span> Ask AIchemist to challenge or pitch in</>}</button><button className="pitch-button pitch-button--sketch" disabled={board.aiStatus === "thinking"} onClick={() => requestAiInput("sketch")}><span>〰</span> Ask AIchemist to sketch this</button><small className={`pitch-note ${aiError || syncError ? "pitch-note--error" : ""}`}>{aiError ?? syncError ?? "Give it a brief or an idea, then ask for a visual framing of the conversation."}</small></section>
      <section className="members-card"><div className="section-heading"><div><p className="eyebrow">IN THE ROOM</p><h2>Project members</h2></div><span>{board.members.length}</span></div><div className="member-list">{board.members.map((member) => <div className="member" key={member.id}><span className={`member-avatar ${member.id === "aichemist" ? "member-avatar--ai" : ""}`} style={{ background: member.color }}>{member.initials}</span><div><strong>{member.name}</strong><small>{member.role}</small></div>{member.id === "aichemist" && <i className={board.aiStatus === "thinking" ? "member-state member-state--thinking" : "member-state"}>{board.aiStatus === "thinking" ? "thinking" : autoPitch ? "roaming" : "here"}</i>}</div>)}</div></section>
      <section className="activity-card"><div className="section-heading"><div><p className="eyebrow">LIVE TRAIL</p><h2>Activity</h2></div><span className="activity-live"><i></i> Live</span></div><ol>{board.activity.slice(0, 6).map((item) => { const actor = memberFor(item.actorId); return <li key={item.id}><span className={`event-avatar ${item.actorId === "aichemist" ? "event-avatar--ai" : ""}`} style={{ background: actor.color }}>{actor.initials}</span><p><strong>{actor.name}</strong> {item.message}<small>{item.timestamp}</small></p></li>; })}</ol></section>
      <section className="focus-card"><p className="eyebrow">{selectedNote ? "IDEA FOCUS" : "SELECT AN IDEA"}</p>{selectedNote ? <><h2>{selectedNote.text}</h2><div className="comment-list">{selectedNote.comments.length ? selectedNote.comments.map((item, index) => <p key={`${item}-${index}`}><span>{memberFor("haaris").initials}</span>{item}</p>) : <p className="empty-comment">No comments yet. Pull someone into the thought.</p>}</div><form onSubmit={addComment}><input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Leave a comment…" aria-label="Leave a comment" /><button type="submit" aria-label="Post comment">↑</button></form></> : <p>Click a sticky note to see its context and leave a comment.</p>}</section>
      <section className="webmcp-card"><div><span className="webmcp-mark">⌘</span><span><strong>WebMCP</strong><small>{mcpStatus === "ready" ? "12 native tools registered" : "Feature detection enabled"}</small></span></div><p>AI agents can inspect, create, move, edit, comment, sketch, connect, and remove board content through the same live session state.</p></section></aside></section>
    {showNewSession && <div className="session-modal-backdrop" role="presentation"><section className="session-modal" role="dialog" aria-modal="true" aria-labelledby="new-session-title"><button className="modal-close" onClick={() => setShowNewSession(false)} aria-label="Close new session dialog">×</button><span className="session-orb">✦</span><p className="landing-kicker">NEW SESSION</p><h2 id="new-session-title">What are you thinking about?</h2><p>Give AIchemist a short brief and it will start with feedback. It waits for human ideas before introducing its own direction.</p><form onSubmit={createSession}><label>Session prompt<input autoFocus value={sessionName} onChange={(event) => setSessionName(event.target.value)} placeholder="e.g. How might we make team rituals more useful?" /></label><label>Context for AIchemist <small>Optional, but recommended</small><textarea value={sessionDescription} onChange={(event) => setSessionDescription(event.target.value)} placeholder="Goal, collaborators, constraints, and what a useful outcome would be." maxLength={900} /></label><button type="submit">Create blank session <span>→</span></button></form><small>This local-preview session stays in this browser until Supabase is configured.</small></section></div>}
    {showShare && <div className="session-modal-backdrop" role="presentation"><section className="session-modal" role="dialog" aria-modal="true" aria-labelledby="share-session-title"><button className="modal-close" onClick={() => setShowShare(false)} aria-label="Close share dialog">×</button><span className="session-orb">↗</span><p className="landing-kicker">INVITE COLLABORATORS</p><h2 id="share-session-title">Share this live room.</h2><p>People with this link can join as editors and see the same canvas in real time.</p>{shareLink ? <><label>Invite link<input readOnly value={shareLink} aria-label="Invite link" /></label><button className="share-copy-button" onClick={() => void navigator.clipboard?.writeText(shareLink)}>Copy invite link</button></> : <button className="share-copy-button" onClick={() => void createShareLink()}>Create and copy invite link</button>}{shareError && <p className="dashboard-error">{shareError}</p>}</section></div>}
  </main>;
}
