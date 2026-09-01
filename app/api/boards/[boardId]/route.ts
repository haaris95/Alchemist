import { NextResponse } from "next/server";
import { isBoardDocument, safeBoardTitle } from "@/lib/api/board-document";
import { requireSupabaseUser } from "@/lib/api/require-user";

export const runtime = "nodejs";

type Context = { params: Promise<{ boardId: string }> };

export async function GET(_: Request, { params }: Context) {
  const session = await requireSupabaseUser();
  if ("error" in session) return session.error;
  const { boardId } = await params;
  const { data, error } = await session.supabase
    .from("boards")
    .select("id,title,document,ai_autonomy,updated_at,owner_id")
    .eq("id", boardId)
    .single();
  if (error || !data) return NextResponse.json({ error: "Board not found or you do not have access." }, { status: 404 });
  if (!isBoardDocument(data.document)) return NextResponse.json({ error: "Board document is invalid." }, { status: 500 });
  return NextResponse.json({ board: { ...data, document: data.document } });
}

export async function PATCH(request: Request, { params }: Context) {
  const session = await requireSupabaseUser();
  if ("error" in session) return session.error;
  const { boardId } = await params;
  const body: unknown = await request.json().catch(() => null);
  const payload = body && typeof body === "object" ? body as Record<string, unknown> : null;
  const document = payload?.document;
  const title = payload?.title === undefined ? undefined : safeBoardTitle(payload.title);
  if (!isBoardDocument(document) || (title !== undefined && !title)) {
    return NextResponse.json({ error: "A complete board document and valid title are required." }, { status: 400 });
  }
  const aiAutonomy = typeof payload?.aiAutonomy === "boolean" ? payload.aiAutonomy : document.aiAutonomy;
  const changes: { document: typeof document; title?: string; ai_autonomy?: boolean; last_human_activity_at?: string; last_ai_pitched_at?: string } = { document };
  if (title) changes.title = title;
  changes.ai_autonomy = aiAutonomy;
  if (document.activity[0]?.actorId === "aichemist") changes.last_ai_pitched_at = new Date().toISOString();
  else changes.last_human_activity_at = new Date().toISOString();
  const { data, error } = await session.supabase
    .from("boards")
    .update(changes)
    .eq("id", boardId)
    .select("id,title,document,ai_autonomy,updated_at")
    .single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Could not update board." }, { status: 400 });
  return NextResponse.json({ board: data });
}
