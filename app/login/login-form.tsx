"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

export default function LoginForm({ nextPath = "/dashboard?new=1" }: { nextPath?: string }) {
  const router = useRouter();
  const realAuth = isSupabaseConfigured();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [ready, setReady] = useState(false);
  const [checkingSession, setCheckingSession] = useState(realAuth);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!realAuth) return;

    let active = true;
    void (async () => {
      const { data: { user } } = await createSupabaseBrowserClient().auth.getUser();
      if (!active) return;
      if (user) {
        router.replace(nextPath);
        return;
      }
      setCheckingSession(false);
    })();

    return () => { active = false; };
  }, [nextPath, realAuth, router]);

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

  async function continueWithoutEmail() {
    if (!realAuth) return;
    setError(null);
    setSending(true);
    const { error: signInError } = await createSupabaseBrowserClient().auth.signInAnonymously({
      options: { data: { full_name: name.trim() || "Guest collaborator" } },
    });
    if (signInError) {
      setError(signInError.message.includes("Anonymous")
        ? "Enable Anonymous Sign-Ins in Supabase Authentication → Providers, then try again."
        : signInError.message);
      setSending(false);
      return;
    }
    router.replace(nextPath);
  }

  const heading = realAuth
    ? "Start immediately in this browser. Add email only when you need it."
    : "Save a local identity, then start a fresh board around the topic you choose.";

  return <section className="login-panel"><div className="login-panel-copy"><p className="landing-kicker">WELCOME IN</p><h2>Join the room.</h2><p>{heading}</p></div>{checkingSession ? <div className="login-success"><span>✦</span><h3>Restoring your session…</h3><p>If you are already signed in here, we will take you straight to your workspace.</p></div> : ready ? <div className="login-success"><span>✓</span><h3>{realAuth ? "Check your inbox, " : "You’re ready, "}{name}.</h3><p>{realAuth ? "We sent a sign-in link to your email. Open it in this same browser to keep your session here." : "Your local profile is saved in this browser. Next, name the topic for your new session."}</p>{!realAuth && <Link href={nextPath}>Continue <b>→</b></Link>}</div> : <><form onSubmit={continueToWorkspace}><label>Your name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Haaris" autoComplete="name" /></label><label>Email address<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="you@example.com" autoComplete="email" /></label><button type="submit" disabled={sending}>{sending ? "Sending secure link…" : realAuth ? "Email me a sign-in link" : "Continue to AIchemist"} <span>→</span></button>{error && <p className="login-error">{error}</p>}</form>{realAuth && <><div className="login-divider"><span>or</span></div><button className="anonymous-button" type="button" disabled={sending} onClick={continueWithoutEmail}>{sending ? "Starting your session…" : "Continue without email"} <span>→</span></button><p className="login-guest-note">Your guest workspace stays signed in on this browser. Use email later if you want to move between devices.</p></>}</>}<p className="login-legal">{realAuth ? "AIchemist remembers your signed-in or guest session in this browser. Email is only needed for a portable account." : "Local preview mode stores only a display profile in this browser. Add Supabase environment values to enable real accounts and shared boards."}</p><Link className="back-home" href="/">← Back to home</Link></section>;
}
