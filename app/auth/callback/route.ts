import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/dashboard";
  // Only allow an internal return path after the email flow.
  const destination = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  if (code) {
    try {
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(destination, requestUrl.origin));
    } catch { /* Fall through to login with an actionable error. */ }
  }
  return NextResponse.redirect(new URL("/login?error=auth_callback", requestUrl.origin));
}
