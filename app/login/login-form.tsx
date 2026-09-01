"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

export default function LoginForm({ nextPath = "/dashboard?new=1" }: { nextPath?: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [ready, setReady] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const realAuth = isSupabaseConfigured();

  function saveLocalProfile(displayName: string, address: string) {
    window.localStorage.setItem("aichemist-member", JSON.stringify({ name: displayName, email: address }));
    setName(displayName);
    setEmail(address);
    setReady(true);
  }

  async function continueToWorkspace(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setError(null);
    if (!realAuth) {
      saveLocalProfile(name.trim(), email.trim());
      return;
    }
    setSending(true);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
    const { error: signInError } = await createSupabaseBrowserClient().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo, data: { full_name: name.trim() } },
    });
    if (signInError) setError(signInError.message);
    else setReady(true);
    setSending(false);
  }

  return <section className="login-panel"><div className="login-panel-copy"><p className="landing-kicker">WELCOME IN</p><h2>Join the room.</h2><p>{realAuth ? "Use a secure email link to open your saved workspaces." : "Save a local identity, then start a fresh board around the topic you choose."}</p></div>{ready ? <div className="login-success"><span>✓</span><h3>{realAuth ? "Check your inbox, " : "You’re ready, "}{name}.</h3><p>{realAuth ? "We sent a sign-in link to your email. Open it in this browser to continue to your new workspace." : "Your local profile is saved in this browser. Next, name the topic for your new session."}</p>{!realAuth && <Link href={nextPath}>Continue <b>→</b></Link>}</div> : <form onSubmit={continueToWorkspace}><label>Your name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Haaris" autoComplete="name" /></label><label>Email address<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="you@example.com" autoComplete="email" /></label><button type="submit" disabled={sending}>{sending ? "Sending secure link…" : realAuth ? "Send me a secure sign-in link" : "Continue to AIchemist"} <span>→</span></button>{error && <p className="login-error">{error}</p>}</form>}<p className="login-legal">{realAuth ? "AIchemist uses Supabase authentication. Your email is used only to send this sign-in link." : "Local preview mode stores only a display profile in this browser. Add Supabase environment values to enable real accounts and shared boards."}</p><Link className="back-home" href="/">← Back to home</Link></section>;
}
