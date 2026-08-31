"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function LoginForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [ready, setReady] = useState(false);

  function saveLocalProfile(displayName: string, address: string) {
    window.localStorage.setItem("aichemist-member", JSON.stringify({ name: displayName, email: address }));
    setName(displayName);
    setEmail(address);
    setReady(true);
  }

  function continueToWorkspace(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !email.trim()) return;
    saveLocalProfile(name.trim(), email.trim());
  }

  return <section className="login-panel"><div className="login-panel-copy"><p className="landing-kicker">WELCOME IN</p><h2>Join the room.</h2><p>Save your local identity, then start a fresh board around the topic you choose.</p></div>{ready ? <div className="login-success"><span>✓</span><h3>You’re ready, {name}.</h3><p>Your local profile is saved in this browser. Next, name the topic for your new session.</p><Link href="/workspace?new=1">Create your first session <b>→</b></Link></div> : <form onSubmit={continueToWorkspace}><label>Your name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Haaris" autoComplete="name" /></label><label>Email address<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="you@example.com" autoComplete="email" /></label><button type="submit">Continue to AIchemist <span>→</span></button><div className="login-divider"><span>or</span></div><button className="google-button" type="button" onClick={() => saveLocalProfile("Guest collaborator", "guest@local.ai")}><i>G</i> Continue as a local guest</button></form>}<p className="login-legal">This MVP saves only a local display profile; it does not create an account or send your details anywhere.</p><Link className="back-home" href="/">← Back to home</Link></section>;
}
