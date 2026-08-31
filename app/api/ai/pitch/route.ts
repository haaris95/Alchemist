import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_NOTES = 40;
const MAX_CONNECTIONS = 60;
const GROQ_RESPONSES_URL = "https://api.groq.com/openai/v1/responses";

type BoardNoteInput = {
  id: string;
  text: string;
  author: string;
  position: { x: number; y: number };
  comments: number;
};

type BoardInput = {
  title: string;
  notes: BoardNoteInput[];
  connections: Array<{ fromId: string; toId: string; label?: string }>;
};

type AiContribution = {
  text: string;
  color: "sun" | "rose" | "mint" | "lavender";
  connectToNoteId: string;
  connectionLabel: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 0;
}

function readBoard(value: unknown): BoardInput | null {
  if (!isRecord(value)) return null;
  const title = text(value.title, 140);
  if (!title || !Array.isArray(value.notes) || !Array.isArray(value.connections)) return null;

  const notes = value.notes.slice(0, MAX_NOTES).flatMap((note): BoardNoteInput[] => {
    if (!isRecord(note) || !isRecord(note.position)) return [];
    const id = text(note.id, 100);
    const noteText = text(note.text, 280);
    if (!id || !noteText) return [];
    return [{
      id,
      text: noteText,
      author: text(note.author, 80) || "Unknown",
      position: { x: number(note.position.x), y: number(note.position.y) },
      comments: Math.max(0, number(note.comments)),
    }];
  });
  const noteIds = new Set(notes.map((note) => note.id));
  const connections = value.connections.slice(0, MAX_CONNECTIONS).flatMap((connection) => {
    if (!isRecord(connection)) return [];
    const fromId = text(connection.fromId, 100);
    const toId = text(connection.toId, 100);
    if (!noteIds.has(fromId) || !noteIds.has(toId)) return [];
    const label = text(connection.label, 50);
    return [{ fromId, toId, ...(label ? { label } : {}) }];
  });
  return { title, notes, connections };
}

function outputText(response: unknown) {
  if (!isRecord(response) || !Array.isArray(response.output)) return "";
  for (const item of response.output) {
    if (!isRecord(item) || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (isRecord(content) && content.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  return "";
}

function readContribution(value: unknown, noteIds: Set<string>): AiContribution | null {
  if (!isRecord(value)) return null;
  const candidate = {
    text: text(value.text, 280),
    color: text(value.color, 20),
    connectToNoteId: text(value.connectToNoteId, 100),
    connectionLabel: text(value.connectionLabel, 50),
  };
  if (candidate.text.length < 3 || !["sun", "rose", "mint", "lavender"].includes(candidate.color)) return null;
  if (candidate.connectToNoteId && !noteIds.has(candidate.connectToNoteId)) return null;
  return candidate as AiContribution;
}

const pitchSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    text: { type: "string", minLength: 3, maxLength: 280, description: "The concise sticky-note contribution." },
    color: { type: "string", enum: ["sun", "rose", "mint", "lavender"] },
    connectToNoteId: { type: "string", description: "An existing note ID to connect to, or an empty string when no connection is useful." },
    connectionLabel: { type: "string", maxLength: 50, description: "A concise relationship label, or an empty string when not connecting." },
  },
  required: ["text", "color", "connectToNoteId", "connectionLabel"],
} as const;

export async function POST(request: Request) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: "Groq is not configured. Add GROQ_API_KEY to .env.local and restart the dev server." }, { status: 503 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON board payload." }, { status: 400 });
  }
  const board = readBoard(isRecord(payload) ? payload.board : null);
  if (!board) return NextResponse.json({ error: "The board snapshot is invalid." }, { status: 400 });

  const model = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
  const prompt = [
    "You are AIchemist, an invited collaborative teammate on a visual whiteboard.",
    "Study the board snapshot and contribute exactly one specific, constructive sticky note. It can identify an assumption, propose a next step, or make a new connection.",
    "Do not repeat an existing note, congratulate the team, or mention that you are an AI. Keep the note under 35 words.",
    "Choose connectToNoteId only from the supplied notes when one direct relationship makes the contribution clearer. Otherwise use empty strings for connectToNoteId and connectionLabel.",
    `Board snapshot:\n${JSON.stringify(board)}`,
  ].join("\n\n");

  let upstream: Response;
  try {
    upstream = await fetch(GROQ_RESPONSES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        max_output_tokens: 180,
        reasoning_effort: "medium",
        input: prompt,
        text: { format: { type: "json_schema", name: "aichemist_contribution", strict: true, schema: pitchSchema } },
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    console.error("AIchemist could not reach Groq", error);
    return NextResponse.json({ error: "AIchemist could not reach Groq. Check your network connection and try again." }, { status: 502 });
  }

  const upstreamBody: unknown = await upstream.json().catch(() => null);
  if (!upstream.ok) {
    const message = isRecord(upstreamBody) && isRecord(upstreamBody.error) ? text(upstreamBody.error.message, 240) : "Groq could not generate a contribution.";
    return NextResponse.json({ error: message || "Groq could not generate a contribution." }, { status: 502 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(outputText(upstreamBody));
  } catch {
    return NextResponse.json({ error: "Groq returned an unreadable contribution." }, { status: 502 });
  }
  const contribution = readContribution(parsed, new Set(board.notes.map((note) => note.id)));
  if (!contribution) return NextResponse.json({ error: "Groq returned an invalid board contribution." }, { status: 502 });

  return NextResponse.json({ contribution, model });
}
