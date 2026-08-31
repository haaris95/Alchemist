"use client";

import Link from "next/link";
import { FormEvent, PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { boardStore, type BoardConnection, type BoardNote, type BoardStroke, type MemberId, type StickyColor } from "@/lib/board";
import { useBoard } from "@/hooks/use-board";
import { useWebMCPTools } from "@/hooks/use-webmcp-tools";

type CanvasTool = "select" | "draw" | "connector";
type GroqContribution = {
  text: string;
  color: StickyColor;
  connectToNoteId: string;
  connectionLabel: string;
};

const STICKY_COLORS: StickyColor[] = ["sun", "rose", "mint", "lavender"];

function isGroqContribution(value: unknown): value is GroqContribution {
  if (!value || typeof value !== "object") return false;
  const contribution = value as Record<string, unknown>;
  return typeof contribution.text === "string"
    && STICKY_COLORS.includes(contribution.color as StickyColor)
    && typeof contribution.connectToNoteId === "string"
    && typeof contribution.connectionLabel === "string";
}

async function getGroqContribution(signal: AbortSignal) {
  const response = await fetch("/api/ai/pitch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ board: boardStore.boardForAgent() }),
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

export default function Workspace() {
  const board = useBoard();
  const [newIdea, setNewIdea] = useState("");
  const [newIdeaColor, setNewIdeaColor] = useState<StickyColor>("sun");
  const [comment, setComment] = useState("");
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [mcpStatus, setMcpStatus] = useState<"checking" | "ready" | "unavailable">("checking");
  const [canvasTool, setCanvasTool] = useState<CanvasTool>("select");
  const [connectionStartId, setConnectionStartId] = useState<string | null>(null);
  const [autoPitch, setAutoPitch] = useState(true);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showNewSession, setShowNewSession] = useState(false);
  const [sessionName, setSessionName] = useState("");
  const [activeStroke, setActiveStroke] = useState<Array<{ x: number; y: number }>>([]);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ noteId: string; offsetX: number; offsetY: number } | null>(null);
  const strokeRef = useRef<Array<{ x: number; y: number }> | null>(null);
  const selectedNote = board.notes.find((note) => note.id === selectedNoteId) ?? null;

  useEffect(() => {
    boardStore.hydrate();
    try {
      const localMember = window.localStorage.getItem("aichemist-member");
      if (localMember) boardStore.setCurrentUser((JSON.parse(localMember) as { name?: string }).name ?? "");
    } catch { /* Local profile is optional. */ }
    const showNewSessionFrame = window.requestAnimationFrame(() => {
      if (window.location.search.includes("new=1")) setShowNewSession(true);
    });
    return () => window.cancelAnimationFrame(showNewSessionFrame);
  }, []);

  const performPitchIn = useCallback(async (signal: AbortSignal) => {
    boardStore.setAiStatus("thinking");
    try {
      setAiError(null);
      const contribution = await getGroqContribution(signal);
      if (signal.aborted) throw new DOMException("Tool call cancelled", "AbortError");
      const result = boardStore.createNote({ text: contribution.text, color: contribution.color, authorId: "aichemist" });
      const targetExists = boardStore.getSnapshot().notes.some((note) => note.id === contribution.connectToNoteId && note.id !== result.note.id);
      const connection = targetExists
        ? boardStore.createConnection({ fromId: contribution.connectToNoteId, toId: result.note.id, label: contribution.connectionLabel, authorId: "aichemist" })
        : null;
      setSelectedNoteId(result.note.id);
      return { note: result.note, connection: connection?.connection, insight: "AIchemist contributed through Groq." };
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setAiError(error instanceof Error ? error.message : "AIchemist could not reach Groq right now.");
      }
      throw error;
    } finally { boardStore.setAiStatus("active"); }
  }, []);

  useEffect(() => {
    const latestActivity = board.activity[0];
    if (!autoPitch || board.aiStatus === "thinking" || board.notes.length === 0 || !latestActivity || latestActivity.actorId === "aichemist") return;
    const timer = window.setTimeout(() => void performPitchIn(new AbortController().signal).catch(() => undefined), 6000);
    return () => window.clearTimeout(timer);
  }, [autoPitch, board.activity, board.aiStatus, board.notes.length, performPitchIn]);

  const onCreateNote = useCallback((input: { text: string; color?: StickyColor; x?: number; y?: number }) => {
    const result = boardStore.createNote({ ...input, authorId: "aichemist", color: input.color ?? "lavender" });
    setSelectedNoteId(result.note.id); return result;
  }, []);
  const onCreateSession = useCallback((input: { title: string }) => {
    boardStore.createSession(input.title, "aichemist");
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
  useWebMCPTools({
    onGetBoard, onCreateSession, onCreateNote, onMoveNote, onUpdateNote, onDeleteNote, onAddComment,
    onCreateConnection, onUpdateConnection, onDeleteConnection, onDrawStroke, onPitchIn: performPitchIn, onStatus,
  });

  function addHumanIdea(event: FormEvent) {
    event.preventDefault(); if (!newIdea.trim()) return;
    const result = boardStore.createNote({ text: newIdea, authorId: "haaris", color: newIdeaColor });
    setNewIdea(""); setSelectedNoteId(result.note.id);
  }
  function addComment(event: FormEvent) {
    event.preventDefault(); if (!selectedNote || !comment.trim()) return;
    boardStore.addComment(selectedNote.id, comment, "haaris"); setComment("");
  }
  function createSession(event: FormEvent) {
    event.preventDefault(); if (!sessionName.trim()) return;
    boardStore.createSession(sessionName); setSelectedNoteId(null); setSessionName(""); setShowNewSession(false); window.history.replaceState({}, "", "/workspace");
  }
  function beginDrag(event: PointerEvent<HTMLButtonElement>, note: BoardNote) {
    if (canvasTool === "connector") {
      event.preventDefault(); setSelectedNoteId(note.id);
      if (connectionStartId && connectionStartId !== note.id) { boardStore.createConnection({ fromId: connectionStartId, toId: note.id, label: "related", authorId: "haaris" }); setConnectionStartId(null); setCanvasTool("select"); }
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
    if (strokeRef.current && strokeRef.current.length > 1) boardStore.addStroke({ points: strokeRef.current, authorId: "haaris" });
    strokeRef.current = null; setActiveStroke([]);
  }
  const memberFor = (memberId: MemberId) => board.members.find((member) => member.id === memberId) ?? board.members[0];
  const connectionFor = (connection: BoardConnection) => { const from = board.notes.find((note) => note.id === connection.fromId); const to = board.notes.find((note) => note.id === connection.toId); return from && to ? { from, to, ...curveFor(from, to) } : null; };

  return <main className="app-shell">
    <header className="topbar"><Link className="brand" href="/"><span className="brand-spark">✦</span><span>AIchemist<small>Your AI teammate in the room</small></span></Link><div className="project-crumb"><span className="crumb-dot"></span><span>Workspaces</span><b>/</b><strong>Current session</strong><b>/</b><em>Brainstorm</em></div><div className="topbar-actions"><span className={`mcp-pill mcp-pill--${mcpStatus}`}><i></i>{mcpStatus === "ready" ? "WebMCP live" : mcpStatus === "checking" ? "Checking WebMCP" : "WebMCP-ready"}</span><button className="avatar-stack" aria-label="Project has three members"><span>H</span><span>S</span><span className="avatar-ai">✦</span></button><button className="share-button">Share</button></div></header>
    <section className="project-header"><div><p className="eyebrow">BRAINSTORMING SESSION <span>•</span> LIVE NOW</p><h1>{board.title}</h1><p className="project-subtitle">Start with fragments, sketch relationships, and let another mind find the opening.</p></div><div className="project-meta"><span><b>{board.notes.length}</b> ideas</span><span><b>{board.connections.length}</b> connections</span><button onClick={() => setShowNewSession(true)}>+ New session</button><button onClick={() => boardStore.reset()}>Load demo</button></div></section>
    <section className="workspace" id="board"><div className="board-column">
      <form className="idea-composer" onSubmit={addHumanIdea}><div className="composer-avatar">{memberFor("haaris").initials}</div><input value={newIdea} onChange={(event) => setNewIdea(event.target.value)} placeholder="Add your thinking to the board…" aria-label="Add a sticky note" /><div className="color-picker" aria-label="Sticky note color">{STICKY_COLORS.map((color) => <button type="button" key={color} className={`color-dot color-dot--${color} ${newIdeaColor === color ? "is-selected" : ""}`} onClick={() => setNewIdeaColor(color)} aria-label={`Use ${color} sticky note`} />)}</div><button className="add-idea" type="submit">Add idea <span>↵</span></button></form>
      <div className="canvas-card"><div className="canvas-toolbar"><div><span className="live-dot"></span><strong>Live canvas</strong><small>{canvasTool === "draw" ? "Sketch freely on the board" : canvasTool === "connector" ? connectionStartId ? "Choose another note to connect" : "Choose the first note to connect" : "Drag ideas to make space"}</small></div><div className="canvas-mode-tools"><button className={canvasTool === "select" ? "is-active" : ""} onClick={() => { setCanvasTool("select"); setConnectionStartId(null); }} aria-label="Select and move">↖ <span>Select</span></button><button className={canvasTool === "draw" ? "is-active" : ""} onClick={() => { setCanvasTool("draw"); setConnectionStartId(null); }} aria-label="Draw on canvas">〰 <span>Draw</span></button><button className={canvasTool === "connector" ? "is-active" : ""} onClick={() => setCanvasTool("connector")} aria-label="Connect ideas">⌁ <span>Connect</span></button></div><div className="canvas-tools"><button onClick={() => setZoom((value) => Math.max(0.76, Number((value - 0.1).toFixed(2))))} aria-label="Zoom out">−</button><span>{Math.round(zoom * 100)}%</span><button onClick={() => setZoom((value) => Math.min(1.15, Number((value + 0.1).toFixed(2))))} aria-label="Zoom in">+</button><button className="fit-button" onClick={() => setZoom(1)}>Fit</button></div></div>
        <div className="canvas-viewport"><div className="canvas-scene" ref={canvasRef} style={{ transform: `scale(${zoom})` }} onPointerMove={dragNote} onPointerUp={stopDrag} onPointerCancel={stopDrag}>{board.clusters.map((cluster) => <div className="cluster" key={cluster.id} style={{ left: cluster.x, top: cluster.y, width: cluster.width, height: cluster.height }}><span>{cluster.label}</span></div>)}<svg className="connections" viewBox="0 0 1100 680" aria-hidden="true"><defs><marker id="arrowhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker></defs>{board.connections.map((connection) => { const line = connectionFor(connection); return line ? <g key={connection.id} className={connection.authorId === "aichemist" ? "connection connection--ai" : "connection"}><path d={line.d} markerEnd="url(#arrowhead)" /><text x={line.x} y={line.y - 10}>{connection.label}</text></g> : null; })}</svg>{board.notes.map((note) => { const author = memberFor(note.authorId); return <button key={note.id} className={`sticky sticky--${note.color} ${note.authorId === "aichemist" ? "sticky--ai" : ""} ${note.id === selectedNoteId ? "sticky--selected" : ""} ${connectionStartId === note.id ? "sticky--connection-origin" : ""}`} style={{ left: note.x, top: note.y }} onPointerDown={(event) => beginDrag(event, note)} onClick={() => setSelectedNoteId(note.id)}><span className="sticky-author"><i style={{ background: author.color }}>{author.initials}</i>{author.name}</span><strong>{note.text}</strong><span className="sticky-footer"><small>{note.createdAt}</small>{note.comments.length > 0 && <em>◌ {note.comments.length}</em>}</span></button>; })}<svg className={`drawing-layer ${canvasTool === "draw" ? "drawing-layer--active" : ""}`} viewBox="0 0 1100 680" onPointerDown={beginDrawing} onPointerMove={continueDrawing} onPointerUp={finishDrawing} onPointerCancel={finishDrawing}>{board.strokes.map((stroke) => <path key={stroke.id} d={strokePath(stroke)} stroke={stroke.color} strokeWidth={stroke.width} />)}{activeStroke.length > 1 && <path d={strokePath({ points: activeStroke })} stroke="#45405b" strokeWidth="3" />}</svg>{board.aiStatus === "thinking" && <div className="ai-cursor"><span>✦</span><p>AIchemist is thinking…</p></div>}</div></div>
        <div className="canvas-footer"><span><i className="human-key"></i> Human idea</span><span><i className="ai-key"></i> AIchemist contribution</span><span><i className="line-key"></i> Connected thinking</span><span><i className="draw-key"></i> Sketch</span><p>{canvasTool === "connector" ? "Click two notes to create a relationship." : "Select a tool, then work directly on the canvas."}</p></div></div>
    </div><aside className="sidebar"><section className={`ai-presence ${board.aiStatus === "thinking" ? "ai-presence--thinking" : ""}`}><div className="ai-presence-head"><span className="ai-orb">✦</span><div><strong>AIchemist</strong><p>{board.aiStatus === "thinking" ? "Thinking with the board" : autoPitch ? "Groq-powered teammate" : "Available on request"}</p></div><span className="presence-status">{board.aiStatus === "thinking" ? "WORKING" : autoPitch ? "AUTO" : "ACTIVE"}</span></div><p className="ai-presence-copy">{board.aiStatus === "thinking" ? "Reading the ideas, looking for an assumption worth challenging." : autoPitch ? "Auto-pitch is on. After a human contribution, I’ll look for a useful opening and join in." : "I’ll wait for you to invite me into the conversation."}</p><label className="autopilot-switch"><span><i>✦</i> Let AIchemist pitch in autonomously</span><input type="checkbox" checked={autoPitch} onChange={(event) => setAutoPitch(event.target.checked)} /><b></b></label><button className="pitch-button" disabled={board.aiStatus === "thinking"} onClick={() => void performPitchIn(new AbortController().signal).catch(() => undefined)}>{board.aiStatus === "thinking" ? <><span className="thinking-ring"></span> Thinking…</> : <><span>✦</span> Ask AIchemist to pitch in now</>}</button><small className={`pitch-note ${aiError ? "pitch-note--error" : ""}`}>{aiError ?? "Groq contributions always land on the shared board."}</small></section>
      <section className="members-card"><div className="section-heading"><div><p className="eyebrow">IN THE ROOM</p><h2>Project members</h2></div><span>{board.members.length}</span></div><div className="member-list">{board.members.map((member) => <div className="member" key={member.id}><span className={`member-avatar ${member.id === "aichemist" ? "member-avatar--ai" : ""}`} style={{ background: member.color }}>{member.initials}</span><div><strong>{member.name}</strong><small>{member.role}</small></div>{member.id === "aichemist" && <i className={board.aiStatus === "thinking" ? "member-state member-state--thinking" : "member-state"}>{board.aiStatus === "thinking" ? "thinking" : autoPitch ? "roaming" : "here"}</i>}</div>)}</div></section>
      <section className="activity-card"><div className="section-heading"><div><p className="eyebrow">LIVE TRAIL</p><h2>Activity</h2></div><span className="activity-live"><i></i> Live</span></div><ol>{board.activity.slice(0, 6).map((item) => { const actor = memberFor(item.actorId); return <li key={item.id}><span className={`event-avatar ${item.actorId === "aichemist" ? "event-avatar--ai" : ""}`} style={{ background: actor.color }}>{actor.initials}</span><p><strong>{actor.name}</strong> {item.message}<small>{item.timestamp}</small></p></li>; })}</ol></section>
      <section className="focus-card"><p className="eyebrow">{selectedNote ? "IDEA FOCUS" : "SELECT AN IDEA"}</p>{selectedNote ? <><h2>{selectedNote.text}</h2><div className="comment-list">{selectedNote.comments.length ? selectedNote.comments.map((item, index) => <p key={`${item}-${index}`}><span>{memberFor("haaris").initials}</span>{item}</p>) : <p className="empty-comment">No comments yet. Pull someone into the thought.</p>}</div><form onSubmit={addComment}><input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Leave a comment…" aria-label="Leave a comment" /><button type="submit" aria-label="Post comment">↑</button></form></> : <p>Click a sticky note to see its context and leave a comment.</p>}</section>
      <section className="webmcp-card"><div><span className="webmcp-mark">⌘</span><span><strong>WebMCP</strong><small>{mcpStatus === "ready" ? "12 native tools registered" : "Feature detection enabled"}</small></span></div><p>AI agents can inspect, create, move, edit, comment, sketch, connect, and remove board content through the same live session state.</p></section></aside></section>
    {showNewSession && <div className="session-modal-backdrop" role="presentation"><section className="session-modal" role="dialog" aria-modal="true" aria-labelledby="new-session-title"><button className="modal-close" onClick={() => setShowNewSession(false)} aria-label="Close new session dialog">×</button><span className="session-orb">✦</span><p className="landing-kicker">NEW SESSION</p><h2 id="new-session-title">What are you thinking about?</h2><p>Start fresh with an empty canvas. AIchemist will quietly join once the room has something to react to.</p><form onSubmit={createSession}><label>Session prompt<input autoFocus value={sessionName} onChange={(event) => setSessionName(event.target.value)} placeholder="e.g. How might we make team rituals more useful?" /></label><button type="submit">Create blank session <span>→</span></button></form><small>Your current board remains local to this browser until you create the new session.</small></section></div>}
  </main>;
}
