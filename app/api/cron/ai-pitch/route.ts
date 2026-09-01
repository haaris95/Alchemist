import { NextResponse } from "next/server";
import { applyAiContribution } from "@/lib/ai/apply-contribution";
import { AiPitchError, agentBoardFromDocument, generateAiContribution, type PitchIntent } from "@/lib/ai/pitch";
import { isBoardDocument } from "@/lib/api/board-document";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

async function run(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  let supabase;
  try { supabase = createSupabaseAdminClient(); } catch { return NextResponse.json({ error: "Background AI is not configured." }, { status: 503 }); }

  const now = new Date();
  const activeSince = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const dueBefore = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
  const { data: candidates, error } = await supabase
    .from("boards")
    .select("id,document,updated_at")
    .eq("ai_autonomy", true)
    .gte("last_human_activity_at", activeSince)
    .or(`last_ai_pitched_at.is.null,last_ai_pitched_at.lt.${dueBefore}`)
    .limit(8);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let contributed = 0;
  const failures: string[] = [];
  for (const candidate of candidates ?? []) {
    if (!isBoardDocument(candidate.document)) continue;
    const intent: PitchIntent = candidate.document.notes.length === 0 ? "starter" : candidate.document.notes.length % 3 === 0 ? "challenge" : "independent";
    try {
      const contribution = await generateAiContribution(agentBoardFromDocument(candidate.document), intent);
      const document = applyAiContribution(candidate.document, contribution, intent);
      const { error: updateError } = await supabase
        .from("boards")
        .update({ document, last_ai_pitched_at: now.toISOString() })
        .eq("id", candidate.id)
        .eq("updated_at", candidate.updated_at);
      if (updateError) failures.push(`${candidate.id}: ${updateError.message}`);
      else contributed += 1;
    } catch (pitchError) {
      failures.push(`${candidate.id}: ${pitchError instanceof AiPitchError ? pitchError.message : "generation failed"}`);
    }
  }
  return NextResponse.json({ checked: candidates?.length ?? 0, contributed, failures });
}

export async function GET(request: Request) { return run(request); }
export async function POST(request: Request) { return run(request); }
