import { NextResponse } from "next/server";
import { isBoardDocument, safeBoardTitle } from "@/lib/api/board-document";
import { requireSupabaseUser } from "@/lib/api/require-user";

export const runtime = "nodejs";

export async function GET() {
  const session = await requireSupabaseUser();
  if ("error" in session) return session.error;
  const { data, error } = await session.supabase
    .from("boards")
    .select("id,title,ai_autonomy,created_at,updated_at,owner_id")
    .order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ boards: data ?? [] });
}

export async function POST(request: Request) {
  const session = await requireSupabaseUser();
  if ("error" in session) return session.error;
  const body: unknown = await request.json().catch(() => null);
  const payload = body && typeof body === "object" ? body as Record<string, unknown> : null;
  const title = safeBoardTitle(payload?.title);
  const document = payload?.document;
  if (!title || !isBoardDocument(document)) {
    return NextResponse.json({ error: "A title and complete board document are required." }, { status: 400 });
  }

  const { data: board, error: boardError } = await session.supabase
    .from("boards")
    .insert({ owner_id: session.user.id, title, document, ai_autonomy: true })
    .select("id,title,ai_autonomy,created_at,updated_at")
    .single();
  if (boardError || !board) return NextResponse.json({ error: boardError?.message ?? "Could not create the board." }, { status: 400 });

  const { error: memberError } = await session.supabase
    .from("board_members")
    .insert({ board_id: board.id, user_id: session.user.id, role: "owner" });
  if (memberError) return NextResponse.json({ error: memberError.message }, { status: 400 });
  return NextResponse.json({ board }, { status: 201 });
}
