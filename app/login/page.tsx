import Link from "next/link";
import LoginForm from "./login-form";

export default function LoginPage() {
  return <main className="login-shell"><section className="login-story"><Link className="brand" href="/"><span className="brand-spark">✦</span><span>AIchemist<small>Your AI teammate in the room</small></span></Link><div><p className="landing-kicker"><i>✦</i> THINK TOGETHER</p><h1>A better room for<br /><em>better ideas.</em></h1><p>Give every collaborator — human and AI — a visible place to make the work move forward.</p></div><div className="login-quote"><span>“</span><p>It feels less like asking a tool and more like inviting a sharp new teammate into the room.</p><small>— Early AIchemist tester</small></div></section><LoginForm /></main>;
}
