import { NextResponse } from "next/server";
import { AiPitchError, generateAiContribution, readAgentBoard, type PitchIntent } from "@/lib/ai/pitch";

export const runtime = "nodejs";

function readIntent(value: unknown): PitchIntent {
  return value === "feedback" || value === "challenge" || value === "independent" || value === "sketch" || value === "diagram" ? value : "feedback";
}

export async function POST(request: Request) {
  const payload: unknown = await request.json().catch(() => null);
  const object = payload && typeof payload === "object" ? payload as Record<string, unknown> : null;
  const board = readAgentBoard(object?.board);
  if (!board) return NextResponse.json({ error: "The board snapshot is invalid." }, { status: 400 });
  const humanNotes = board.notes.filter((note) => note.author.toLowerCase() !== "aichemist").length;
  if (humanNotes === 0 && board.description.trim().length < 24) {
    return NextResponse.json({ error: "Add a session brief or a first human idea before asking AIchemist to contribute." }, { status: 400 });
  }
  const requestedIntent = readIntent(object?.intent);
  const intent: PitchIntent = requestedIntent === "sketch" || requestedIntent === "diagram" ? requestedIntent : humanNotes < 2 ? "feedback" : requestedIntent;
  try {
    const contribution = await generateAiContribution(board, intent);
    return NextResponse.json({ contribution, model: process.env.GROQ_MODEL || "openai/gpt-oss-120b" });
  } catch (error) {
    if (error instanceof AiPitchError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "AIchemist could not generate a contribution." }, { status: 502 });
  }
}
