import { NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/api/require-user";

export const runtime = "nodejs";

type Context = { params: Promise<{ boardId: string }> };

export async function POST(_: Request, { params }: Context) {
  const session = await requireSupabaseUser();
  if ("error" in session) return session.error;
  const { boardId } = await params;
  const { data, error } = await session.supabase
    .from("board_invites")
    .insert({ board_id: boardId, created_by: session.user.id, role: "editor" })
    .select("token")
    .single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Could not create an invite." }, { status: 400 });
  return NextResponse.json({ token: data.token });
}
