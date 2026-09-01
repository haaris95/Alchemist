import { NextResponse } from "next/server";
import { AiPitchError, generateAiContribution, readAgentBoard, type PitchIntent } from "@/lib/ai/pitch";

export const runtime = "nodejs";

function readIntent(value: unknown): PitchIntent {
  return value === "starter" || value === "challenge" || value === "independent" ? value : "independent";
}

export async function POST(request: Request) {
  const payload: unknown = await request.json().catch(() => null);
  const object = payload && typeof payload === "object" ? payload as Record<string, unknown> : null;
  const board = readAgentBoard(object?.board);
  if (!board) return NextResponse.json({ error: "The board snapshot is invalid." }, { status: 400 });
  try {
    const contribution = await generateAiContribution(board, readIntent(object?.intent));
    return NextResponse.json({ contribution, model: process.env.GROQ_MODEL || "openai/gpt-oss-120b" });
  } catch (error) {
    if (error instanceof AiPitchError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "AIchemist could not generate a contribution." }, { status: 502 });
  }
}
