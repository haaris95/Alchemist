import type { BoardConnection, BoardNote, BoardState } from "@/lib/board";
import type { AiContribution, PitchIntent } from "./pitch";

function clock() {
  return new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date());
}

export function applyAiContribution(document: BoardState, contribution: AiContribution, intent: PitchIntent): BoardState {
  const note: BoardNote = {
    id: `note-ai-${Date.now()}-${Math.round(Math.random() * 1000)}`,
    text: contribution.text,
    authorId: "aichemist",
    color: contribution.color,
    x: 100 + (document.notes.length % 4) * 220,
    y: document.notes.length === 0 ? 220 : 470 + (Math.floor(document.notes.length / 4) % 2) * 34,
    comments: [],
    createdAt: clock(),
  };
  const connection: BoardConnection[] = contribution.connectToNoteId && document.notes.some((item) => item.id === contribution.connectToNoteId)
    ? [{ id: `connection-ai-${Date.now()}-${Math.round(Math.random() * 1000)}`, fromId: contribution.connectToNoteId, toId: note.id, label: contribution.connectionLabel || undefined, authorId: "aichemist" }]
    : [];
  const message = intent === "starter" ? "started the room with an original direction" : intent === "challenge" ? "challenged an assumption on the board" : "introduced an independent direction";
  return {
    ...document,
    notes: [...document.notes, note],
    connections: [...document.connections, ...connection],
    activity: [{ id: `activity-ai-${Date.now()}-${Math.round(Math.random() * 1000)}`, actorId: "aichemist", message, timestamp: clock() }, ...document.activity].slice(0, 16),
    aiStatus: "active",
  };
}
