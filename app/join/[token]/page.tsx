"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export default function JoinBoardPage({ params }: { params: Promise<{ token: string }> }) {
  const router = useRouter();
  const [message, setMessage] = useState("Joining the shared room…");

  useEffect(() => {
    let active = true;
    void (async () => {
      const { token } = await params;
      if (!isSupabaseConfigured()) {
        if (active) setMessage("This invite needs Supabase to be configured on the deployment.");
        return;
      }
      const response = await fetch("/api/invites/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      const body: unknown = await response.json().catch(() => null);
      const boardId = body && typeof body === "object" ? (body as { boardId?: unknown }).boardId : null;
      if (response.ok && typeof boardId === "string") {
        router.replace(`/workspace/${boardId}`);
        return;
      }
      if (response.status === 401) {
        router.replace(`/login?next=${encodeURIComponent(`/join/${token}`)}`);
        return;
      }
      if (active) setMessage(body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string" ? (body as { error: string }).error : "This invite could not be accepted. Sign in first, then open the link again.");
    })();
    return () => { active = false; };
  }, [params, router]);

  return <main className="login-shell"><section className="login-story"><Link className="brand" href="/"><span className="brand-spark">✦</span><span>AIchemist<small>Your AI teammate in the room</small></span></Link></section><section className="login-panel"><div className="login-success"><span>✦</span><h3>Shared thinking awaits.</h3><p>{message}</p><Link href="/login">Go to sign in <b>→</b></Link></div></section></main>;
}
