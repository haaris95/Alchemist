import { NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/api/require-user";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await requireSupabaseUser();
  if ("error" in session) return session.error;
  const body: unknown = await request.json().catch(() => null);
  const token = body && typeof body === "object" && typeof (body as { token?: unknown }).token === "string"
    ? (body as { token: string }).token
    : "";
  if (!token) return NextResponse.json({ error: "An invite token is required." }, { status: 400 });
  const { data: boardId, error } = await session.supabase.rpc("accept_board_invite", { invite_token: token });
  if (error || !boardId) return NextResponse.json({ error: error?.message ?? "Invite is invalid or expired." }, { status: 400 });
  return NextResponse.json({ boardId });
}
