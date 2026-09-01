import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireSupabaseUser() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return { error: NextResponse.json({ error: "Sign in to continue." }, { status: 401 }) };
    return { supabase, user };
  } catch {
    return { error: NextResponse.json({ error: "Supabase is not configured on this deployment." }, { status: 503 }) };
  }
}
