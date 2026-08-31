import Link from "next/link";

const highlights = [
  ["✦", "A teammate, not a sidebar", "AIchemist adds ideas, questions, and connections directly where your team is working."],
  ["⌁", "Shared visual thinking", "Turn fragments into a living map with sticky notes, sketches, comments, and relationship lines."],
  ["↗", "From messy to moving", "Keep the generative moment, then find the assumptions and next experiments worth carrying forward."],
];

export default function Home() {
  return <main className="marketing-shell">
    <header className="marketing-nav"><Link className="brand" href="/"><span className="brand-spark">✦</span><span>AIchemist<small>Your AI teammate in the room</small></span></Link><nav><a href="#how-it-works">How it works</a><a href="#workspace-preview">Workspace</a></nav><div><Link className="nav-login" href="/login">Log in</Link><Link className="nav-cta" href="/login?next=new">Start a session <span>↗</span></Link></div></header>

    <section className="landing-hero">
      <div className="hero-copy"><p className="landing-kicker"><i>✦</i> COLLABORATION, RE-ALCHEMIZED</p><h1>Your next breakthrough needs <em>another mind</em> in the room.</h1><p>AIchemist is a visual workspace where humans and AI create, challenge, sketch, and make sense of ideas together.</p><div className="hero-actions"><Link className="hero-primary" href="/login?next=new">Start a new session <span>→</span></Link><Link className="hero-secondary" href="/workspace">Explore the demo board <span>↗</span></Link></div><div className="landing-members"><div className="landing-avatars"><span>H</span><span>S</span><span>✦</span></div><p>Built for the moment when a good idea needs<br />a thoughtful challenge.</p></div></div>
      <div className="hero-visual" aria-label="AIchemist workspace preview"><div className="preview-spark preview-spark--one">✦</div><div className="preview-spark preview-spark--two">✦</div><div className="preview-board"><div className="preview-top"><span>● Live board</span><i></i><i></i><i></i></div><div className="preview-cluster">SURPLUS RECOVERY</div><div className="preview-note preview-note--yellow"><small><i>H</i> Haaris</small><strong>Restaurants throw away food at the end of the day.</strong></div><div className="preview-note preview-note--rose"><small><i>S</i> Sarah</small><strong>Could we redirect it before closing?</strong></div><div className="preview-note preview-note--ai"><small><i>✦</i> AIchemist</small><strong>What if we predicted surplus before it happens?</strong></div><svg viewBox="0 0 520 390" aria-hidden="true"><path d="M145 175 C240 180 240 255 292 265" /><path d="M370 310 C390 277 335 252 295 248" /></svg><div className="preview-thinking"><span>✦</span> AIchemist is connecting ideas</div></div></div>
    </section>

    <section className="trust-line"><span>Bring every thought into the room</span><i></i><span>Keep the human spark at the center</span><i></i><span>Let AI do more than answer</span></section>
    <section className="landing-features" id="how-it-works"><div className="section-intro"><p className="landing-kicker">ONE SHARED SPACE</p><h2>Not a chatbot pasted onto a whiteboard.</h2><p>AIchemist makes the AI’s contributions visible, attributable, and open for the team to build on.</p></div><div className="feature-grid">{highlights.map(([mark, title, body]) => <article key={title}><span>{mark}</span><h3>{title}</h3><p>{body}</p></article>)}</div></section>
    <section className="landing-cta" id="workspace-preview"><div><p className="landing-kicker">READY WHEN THE ROOM IS</p><h2>Start with a blank canvas.<br /><em>Bring the first thought.</em></h2></div><Link href="/login?next=new">Create a session <span>→</span></Link></section>
    <footer className="marketing-footer"><Link className="brand" href="/"><span className="brand-spark">✦</span><span>AIchemist</span></Link><p>© 2026 AIchemist. Thinking is better together.</p><Link href="/login">Log in</Link></footer>
  </main>;
}
