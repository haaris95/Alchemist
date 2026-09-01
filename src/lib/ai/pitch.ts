import type { BoardState, StickyColor } from "@/lib/board";

const GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions";
const MAX_NOTES = 40;
const MAX_CONNECTIONS = 60;

export type PitchIntent = "feedback" | "independent" | "challenge" | "sketch";
export type AiStroke = { points: Array<{ x: number; y: number }>; color: string; width: number };
export type AiContribution = { text: string; color: StickyColor; connectToNoteId: string; connectionLabel: string; strokes: AiStroke[] };

type BoardNoteInput = { id: string; text: string; author: string; position: { x: number; y: number }; comments: number };
export type AgentBoard = { title: string; description: string; notes: BoardNoteInput[]; connections: Array<{ fromId: string; toId: string; label?: string }> };

export class AiPitchError extends Error {
  constructor(message: string, readonly status = 502) { super(message); }
}

function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function text(value: unknown, maxLength: number) { return typeof value === "string" ? value.trim().slice(0, maxLength) : ""; }
function number(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 0; }
function coordinate(value: unknown, minimum: number, maximum: number) { return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum ? Math.round(value) : null; }

export function readAgentBoard(value: unknown): AgentBoard | null {
  if (!isRecord(value)) return null;
  const title = text(value.title, 140);
  const description = text(value.description, 900);
  if (!title || !Array.isArray(value.notes) || !Array.isArray(value.connections)) return null;
  const notes = value.notes.slice(0, MAX_NOTES).flatMap((note): BoardNoteInput[] => {
    if (!isRecord(note) || !isRecord(note.position)) return [];
    const id = text(note.id, 100); const noteText = text(note.text, 280);
    if (!id || !noteText) return [];
    return [{ id, text: noteText, author: text(note.author, 80) || "Unknown", position: { x: number(note.position.x), y: number(note.position.y) }, comments: Math.max(0, number(note.comments)) }];
  });
  const noteIds = new Set(notes.map((note) => note.id));
  const connections = value.connections.slice(0, MAX_CONNECTIONS).flatMap((connection) => {
    if (!isRecord(connection)) return [];
    const fromId = text(connection.fromId, 100); const toId = text(connection.toId, 100);
    if (!noteIds.has(fromId) || !noteIds.has(toId)) return [];
    const label = text(connection.label, 50);
    return [{ fromId, toId, ...(label ? { label } : {}) }];
  });
  return { title, description, notes, connections };
}

export function agentBoardFromDocument(document: BoardState): AgentBoard {
  const members = new Map(document.members.map((member) => [member.id, member.name]));
  return {
    title: document.title,
    description: typeof document.description === "string" ? document.description : "",
    notes: document.notes.map((note) => ({ id: note.id, text: note.text, author: members.get(note.authorId) ?? "Collaborator", position: { x: note.x, y: note.y }, comments: note.comments.length })),
    connections: document.connections.map(({ fromId, toId, label }) => ({ fromId, toId, ...(label ? { label } : {}) })),
  };
}

function readStrokes(value: unknown): AiStroke[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 3) return null;
  const strokes: AiStroke[] = [];
  for (const rawStroke of value) {
    if (!isRecord(rawStroke) || !Array.isArray(rawStroke.points) || rawStroke.points.length < 2 || rawStroke.points.length > 10) return null;
    const points: AiStroke["points"] = [];
    for (const rawPoint of rawStroke.points) {
      if (!isRecord(rawPoint)) return null;
      const x = coordinate(rawPoint.x, 18, 970); const y = coordinate(rawPoint.y, 48, 570);
      if (x === null || y === null) return null;
      points.push({ x, y });
    }
    const color = text(rawStroke.color, 20);
    if (!/^#[0-9a-f]{6}$/i.test(color)) return null;
    const width = coordinate(rawStroke.width, 1, 12);
    if (width === null) return null;
    strokes.push({ points, color, width });
  }
  return strokes;
}

function readContribution(value: unknown, noteIds: Set<string>, intent: PitchIntent): AiContribution | null {
  if (!isRecord(value)) return null;
  const candidate = { text: text(value.text, 280), color: text(value.color, 20), connectToNoteId: text(value.connectToNoteId, 100), connectionLabel: text(value.connectionLabel, 50) };
  const strokes = readStrokes(value.strokes);
  if (candidate.text.length < 3 || !["sun", "rose", "mint", "lavender"].includes(candidate.color)) return null;
  if (!strokes || (intent === "sketch" && strokes.length === 0)) return null;
  if (candidate.connectToNoteId && !noteIds.has(candidate.connectToNoteId)) return null;
  return { ...candidate, color: candidate.color as StickyColor, strokes };
}

function extractJsonObject(value: string) {
  const first = value.indexOf("{"); const last = value.lastIndexOf("}");
  if (first === -1 || last <= first) return null;
  try { return JSON.parse(value.slice(first, last + 1)); } catch { return null; }
}

function systemPrompt(intent: PitchIntent) {
  const mode = intent === "sketch"
    ? "Create a simple, useful visual explanation of the existing session brief and human thinking. Do not invent a new direction. You must include one to three legible polyline strokes that show a relationship, flow, trade-off, or decision frame; use no text inside the drawing."
    : intent === "feedback"
    ? "Act as a precise thinking partner. Give grounded feedback on the session brief and the human notes already present: surface a decision to make, an ambiguity to resolve, or a criterion that is missing. Do not introduce an unrelated solution or a new strategic direction. If there are no human notes, assess the session brief rather than extrapolating from the title alone."
    : intent === "challenge"
      ? "Act as a constructive dissenter. Identify a risky hidden assumption, feasibility gap, or reason to reject a direction. You may say the team should not pursue something, but make the objection specific and offer a more useful test or alternative."
      : "Introduce a genuinely independent direction, reframing, experiment, or leverage point. Do more than summarize or give generic feedback.";
  return [
    "You are AIchemist, an autonomous intellectual peer on a collaborative visual whiteboard.", mode,
    "Be original, candid, and respectful. Attack reasoning, never people. Do not praise the team, repeat a note, mention being an AI, or hedge with empty questions.",
    "Reply with exactly one JSON object and no Markdown: {\"text\":string,\"color\":\"sun\"|\"rose\"|\"mint\"|\"lavender\",\"connectToNoteId\":string,\"connectionLabel\":string,\"strokes\":[{\"points\":[{\"x\":number,\"y\":number}],\"color\":\"#7054ce\",\"width\":3}]}. Keep text under 35 words. Use an existing note id only when a direct relationship materially helps; otherwise both connection fields must be empty strings. Use an empty strokes array unless you were asked to sketch. For a sketch, include one to three strokes, each with 2–10 points. Canvas bounds are x 18–970 and y 48–570.",
  ].join("\n\n");
}

export async function generateAiContribution(board: AgentBoard, intent: PitchIntent): Promise<AiContribution> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) throw new AiPitchError("Groq is not configured. Add GROQ_API_KEY to .env.local and restart the dev server.", 503);
  const model = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
  let upstream: Response;
  try {
    upstream = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: [{ role: "system", content: systemPrompt(intent) }, { role: "user", content: `Board snapshot:\n${JSON.stringify(board)}` }], temperature: 0.9, top_p: 1, max_completion_tokens: 512, reasoning_effort: "low" }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch { throw new AiPitchError("AIchemist could not reach Groq. Check your network connection and try again."); }
  const body: unknown = await upstream.json().catch(() => null);
  if (!upstream.ok) {
    const message = isRecord(body) && isRecord(body.error) ? text(body.error.message, 240) : "Groq could not generate a contribution.";
    throw new AiPitchError(message || "Groq could not generate a contribution.");
  }
  const content = isRecord(body) && Array.isArray(body.choices) && isRecord(body.choices[0]) && isRecord(body.choices[0].message) ? body.choices[0].message.content : "";
  const parsed = typeof content === "string" ? extractJsonObject(content) : null;
  const contribution = readContribution(parsed, new Set(board.notes.map((note) => note.id)), intent);
  if (!contribution) throw new AiPitchError("Groq returned an unreadable board contribution.");
  return contribution;
}
