import Link from "next/link";
import { Topography } from "@/components/site/Brand";
import { Reveal, StepBeam } from "@/components/site/Interactive";
import { GapVisual, HeroProduct, PillarGlyph, SignalField } from "@/components/site/Mockups";
import { DependencyGraph } from "@/components/site/DependencyGraph";
import { AskBeacon } from "@/components/site/AskBeacon";
import { Integrations } from "@/components/site/Integrations";
import { BuiltByBand } from "@/components/site/BuiltByBand";
import { SideBySide } from "@/components/site/SideBySide";

const Arrow = () => <span className="arrow" aria-hidden="true">→</span>;

const STEPS: { title: string; body: string; card: React.ReactNode }[] = [
  {
    title: "Product changes a launch requirement",
    body: "A requirement moves. Nobody has to remember who else it touches.",
    card: (
      <>
        <div className="line"><span className="chip">Product</span><span className="muted">Ava Thompson</span></div>
        <div>&ldquo;Enterprise payouts must include audit logs at launch.&rdquo;</div>
      </>
    ),
  },
  {
    title: "Beacon identifies the dependencies",
    body: "It knows who owns audit logging and who signs off on evidence, from the organization's own map of ownership.",
    card: (
      <>
        <div className="line"><span className="chip">Engineering</span>Audit logging for payouts · Diego Alvarez</div>
        <div className="line"><span className="chip">Compliance</span>Evidence review · Compliance lead</div>
      </>
    ),
  },
  {
    title: "It surfaces the impact on the timeline",
    body: "Before anyone schedules a meeting, the consequence is visible.",
    card: (
      <div className="line"><span className="pill warn">Launch at risk</span>Dec 15 → Dec 19 unless audit logging starts Monday</div>
    ),
  },
  {
    title: "The relevant owners are notified",
    body: "Each team hears about it at the level of detail it needs, in the tools it already uses.",
    card: (
      <>
        <div className="line"><span className="pill info">Full detail</span>Engineering</div>
        <div className="line"><span className="pill info">Summary</span>Compliance</div>
        <div className="line"><span className="pill info">Headline</span>Sales</div>
      </>
    ),
  },
  {
    title: "A proposed resolution is reviewed and approved",
    body: "People decide. Beacon drafts the options and records the decision where everyone can find it.",
    card: (
      <>
        <div>Ship audit logs behind a flag for enterprise accounts first; keep Dec 15 for everyone else.</div>
        <div className="line"><span className="pill ok">Approved</span><span className="muted">by Ava Thompson</span></div>
      </>
    ),
  },
  {
    title: "Beacon tracks the commitment through completion",
    body: "Owners, due dates and status stay connected to the original intent, so nothing slips quietly.",
    card: (
      <>
        <div className="line"><span className="pill ok">Done</span>Audit logging · Engineering · Dec 12</div>
        <div className="line"><span className="pill ok">On track</span>Evidence review · Compliance · Dec 13</div>
        <div className="line"><span className="pill ok">On track</span>Launch · Product · Dec 15</div>
      </>
    ),
  },
];

const CASES = [
  {
    t: "Product and Engineering",
    d: "Keep requirements, technical decisions, dependencies and delivery aligned.",
    l: ["Requirement changes reach every team they touch", "Technical constraints flow back before dates are promised"],
    icon: <path d="M4 7h16M4 12h10M4 17h7M17 14l3 3-3 3" />,
  },
  {
    t: "Leadership",
    d: "Understand organizational priorities, blockers and execution across departments.",
    l: ["One operating picture instead of status meetings", "Slipped commitments surface with their reason"],
    icon: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  },
  {
    t: "Operations",
    d: "Coordinate workflows and resolve handoffs across teams.",
    l: ["Clear owners for every handoff", "Questions routed to the right person, batched"],
    icon: <path d="M5 12h4l2-5 2 10 2-5h4" />,
  },
  {
    t: "AI-native organizations",
    d: "Coordinate people and AI agents through a shared organizational context.",
    l: ["Agents work with the requester's access, never more", "Every agent action is reviewable and logged"],
    icon: <><rect x="5" y="7" width="14" height="12" rx="3" /><path d="M12 3v4M9 12h.01M15 12h.01" /></>,
  },
];

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="hero">
        <Topography />
        <div className="wrap">
          <div className="hero-copy">
            <span className="eyebrow">Where people and AI agents work side by side</span>
            <h1 className="h1">
              Your organization is working.
              <span className="second">Is it working together?</span>
            </h1>
            <p className="lede">
              Beacon is the platform where people and AI agents work side by side. Every team gets an agent that answers for it, does the
              legwork and routes the rest to the right person, so people spend their time on decisions instead of chasing status.
            </p>
            <div className="hero-ctas">
              <Link className="btn btn-primary" href="/early-access">Request early access <Arrow /></Link>
              <a className="btn btn-ghost" href="#how-it-works">See how it works</a>
            </div>
            <p className="hero-note">One operating picture. Every team. Every initiative.</p>
          </div>
          <div className="hero-product">
            <HeroProduct />
          </div>
        </div>
      </section>

      <BuiltByBand />

      {/* The coordination gap */}
      <section className="section" aria-labelledby="gap-title">
        <div className="wrap gap-grid">
          <Reveal className="gap-copy">
            <span className="eyebrow">The coordination gap</span>
            <h2 id="gap-title" className="h2" style={{ margin: "16px 0 24px" }}>Your tools are connected. Your organization isn&apos;t.</h2>
            <p>Every department has its own systems, priorities and workflows.</p>
            <p>Product lives in roadmaps. Engineering lives in code and tickets. Sales lives in the CRM. Operations lives in its own processes.</p>
            <p>But the important work happens between those systems. A product decision affects engineering capacity. An engineering delay affects a customer commitment. A change in priorities affects several departments.</p>
            <p>Today, connecting those dots often depends on someone noticing, asking around and manually coordinating the response.</p>
            <p className="pull">Beacon makes those connections visible.</p>
          </Reveal>
          <Reveal delay={120}>
            <GapVisual />
          </Reveal>
        </div>
      </section>

      <div className="wrap"><div className="divider" /></div>

      {/* What Beacon does */}
      <section className="section" id="product" aria-labelledby="product-title">
        <div className="wrap">
          <Reveal className="section-head">
            <span className="eyebrow">What Beacon does</span>
            <h2 id="product-title" className="h2">A new layer between your teams, not another tool beside them.</h2>
          </Reveal>
          <div className="pillars">
            {[
              { n: "01", k: "Unify context", t: "A living model of your organization.", p: "Beacon connects knowledge about people, teams, initiatives, decisions, responsibilities and systems.", g: "context" as const },
              { n: "02", k: "Coordinate work", t: "Understand how work connects.", p: "Identify dependencies, surface blockers, route questions to the right people and keep teams aligned.", g: "coordinate" as const },
              { n: "03", k: "Drive execution", t: "Move from awareness to action.", p: "Coordinate workflows, delegate approved tasks to AI agents and people, follow up on commitments, and keep initiatives moving.", g: "execute" as const },
            ].map((x, i) => (
              <Reveal key={x.n} className="pillar" delay={i * 90}>
                <div className="glyph"><PillarGlyph kind={x.g} /></div>
                <span className="num">{x.n} — {x.k.toUpperCase()}</span>
                <h3 className="h3">{x.t}</h3>
                <p>{x.p}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <SideBySide />

      <Integrations />

      {/* Product showcase */}
      <section className="section showcase" id="showcase" aria-labelledby="show-title">
        <div className="wrap">
          <Reveal className="section-head">
            <span className="eyebrow">Product</span>
            <h2 id="show-title" className="h2">See the whole organization, then ask it anything.</h2>
            <p className="lede">
              Initiatives, owners, dependencies and decisions in one operating picture, with answers drawn only from what each person is allowed to see.
            </p>
          </Reveal>
          <div className="window" style={{ marginBottom: 18 }}>
            <div className="window-bar">
              <div className="window-dots" aria-hidden="true"><i /><i /><i /></div>
              <span className="window-title">Organization overview</span>
              <span className="demo-label">Illustrative demo data</span>
            </div>
            <div className="stats">
              <div className="stat"><div className="k">Active initiatives</div><div className="v">12</div><div className="d">across 8 teams</div></div>
              <div className="stat"><div className="k">Cross-team blockers</div><div className="v" style={{ color: "#c0392b" }}>3</div><div className="d">1 slipped commitment</div></div>
              <div className="stat"><div className="k">Upcoming milestones</div><div className="v">5</div><div className="d">in the next 14 days</div></div>
              <div className="stat"><div className="k">At-risk projects</div><div className="v" style={{ color: "#b26a00" }}>2</div><div className="d">both depend on Platform</div></div>
            </div>
            <div style={{ padding: 16 }}>
              <div className="show-grid">
                <DependencyGraph />
                <AskBeacon />
              </div>
            </div>
          </div>
          <p className="show-note">
            <span>Everything above uses illustrative data about a fictional company.</span>
            <Link href="/feed">Explore the working prototype →</Link>
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="section" id="how-it-works" aria-labelledby="flow-title">
        <div className="wrap flow">
          <div className="flow-sticky">
            <span className="eyebrow">How it works</span>
            <h2 id="flow-title" className="h2" style={{ marginTop: 16 }}>From a question to coordinated action.</h2>
            <p className="lede" style={{ marginTop: 18 }}>
              Beacon connects intent to execution. A change in one team becomes the right next step for every team it touches, with people approving
              what matters.
            </p>
            <p className="muted" style={{ fontSize: 13.5, marginTop: 14 }}>Illustrative scenario.</p>
          </div>
          <StepBeam count={STEPS.length}>
            {STEPS.map((s, i) => (
              <li key={s.title} className="step">
                <span className="dot">{i + 1}</span>
                <div>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                  <div className="card">{s.card}</div>
                </div>
              </li>
            ))}
          </StepBeam>
        </div>
      </section>

      <div className="wrap"><div className="divider" /></div>

      {/* Who it's for */}
      <section className="section" id="use-cases" aria-labelledby="cases-title">
        <div className="wrap">
          <Reveal className="section-head">
            <span className="eyebrow">Who it&apos;s for</span>
            <h2 id="cases-title" className="h2">For the people who keep work moving between teams.</h2>
          </Reveal>
          <div className="cases">
            {CASES.map((c, i) => (
              <Reveal key={c.t} className="case" delay={(i % 2) * 90}>
                <span className="ic">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{c.icon}</svg>
                </span>
                <div>
                  <h3 className="h3">{c.t}</h3>
                  <p>{c.d}</p>
                  <ul>{c.l.map((x) => <li key={x}>{x}</li>)}</ul>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section className="section" id="about" aria-labelledby="about-title" style={{ paddingTop: 40 }}>
        <div className="wrap about-grid">
          <Reveal>
            <span className="eyebrow">About</span>
            <h2 id="about-title" className="sr-only">About Beacon</h2>
            <p className="thesis">
              Organizations don&apos;t have an information problem. They have a <em>coordination problem.</em>
            </p>
          </Reveal>
          <Reveal className="about-copy" delay={100}>
            <p>
              Much of the workday goes to status meetings, handoffs and asking other teams what they decided or when they&apos;ll deliver. The
              information usually exists. It just doesn&apos;t reach the people who depend on it, when they need it.
            </p>
            <p>
              Beacon is building the shared operating layer for that work: a living model of who owns what, what depends on what and what was
              decided, with AI agents that answer, route and follow up inside clear boundaries.
            </p>
            <div className="not-list">
              <div><b>Not a chatbot.</b><span>It works from shared context, ownership and permissions, not a blank prompt.</span></div>
              <div><b>Not a knowledge base.</b><span>It brings the right information to the people who need it, without waiting to be searched.</span></div>
              <div><b>Not a project tracker.</b><span>It connects work across the tools teams already use.</span></div>
              <div><b>Not workflow automation.</b><span>It coordinates people and agents around decisions, not just triggers.</span></div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Final CTA */}
      <section className="final" aria-labelledby="final-title">
        <SignalField />
        <div className="wrap" style={{ position: "relative" }}>
          <span className="eyebrow">Early access</span>
          <h2 id="final-title" className="h2">Give your organization a shared signal.</h2>
          <p>See what happens when every team can understand the work happening around them.</p>
          <div className="hero-ctas">
            <Link className="btn btn-primary" href="/early-access">Request early access <Arrow /></Link>
            <Link className="btn btn-ghost" href="/feed">Try the interactive demo</Link>
          </div>
        </div>
      </section>
    </>
  );
}
