import Link from "next/link";
import { Topography } from "@/components/site/Brand";
import { Reveal, StepBeam } from "@/components/site/Interactive";
import { GapVisual, HeroProduct, PillarGlyph, SignalField, TeamPicture } from "@/components/site/Mockups";
import { AskBeacon } from "@/components/site/AskBeacon";
import { Integrations } from "@/components/site/Integrations";
import { BuiltByBand } from "@/components/site/BuiltByBand";
import { SideBySide } from "@/components/site/SideBySide";

const Arrow = () => <span className="arrow" aria-hidden="true">→</span>;

const STEPS: { title: string; body: string; card: React.ReactNode }[] = [
  {
    title: "Ask about a team",
    body: "In Beacon or from Slack, ask what a team does, owns, knows or can help with. No need to know who to ask first.",
    card: (
      <>
        <div className="line"><span className="chip">Product</span><span className="muted">Ava Thompson</span></div>
        <div>&ldquo;Can Platform support single sign-on for our new merchant admin console?&rdquo;</div>
      </>
    ),
  },
  {
    title: "The team's agent answers from what it knows",
    body: "Each point says where it came from: confirmed by the team, learned from its conversations, or seen in its tools. Guesses are labelled as guesses.",
    card: (
      <>
        <div className="line"><span className="pill ok">Confirmed by Platform</span>Platform owns sign-in and single sign-on</div>
        <div className="line"><span className="pill info">Learned from Ken&apos;s answer</span>SAML already runs for internal tools</div>
        <div className="line"><span className="pill gray">Seen in GitHub</span>Session tokens are being migrated</div>
      </>
    ),
  },
  {
    title: "It says what it doesn't know",
    body: "Instead of guessing, Beacon shows what's missing and asks a clarifying question when it needs one.",
    card: (
      <>
        <div className="muted">Couldn&apos;t find: anything about sign-on for merchants rather than staff.</div>
        <div className="line" style={{ marginTop: 6 }}><b>Is this for Northwind staff, or merchants&apos; own admins?</b></div>
      </>
    ),
  },
  {
    title: "The rest goes to the right team",
    body: "To the person who owns the area, or to the team's queue where anyone who knows can pick it up. You always see where it went.",
    card: (
      <div className="line"><span className="pill warn">Awaiting Platform</span>In Platform&apos;s team queue, since no one person owns merchant sign-on</div>
    ),
  },
  {
    title: "A teammate answers once",
    body: "The reply reaches everyone who asked the same thing, and stays private to them.",
    card: (
      <>
        <div>&ldquo;Not for merchants yet. It&apos;s about three weeks of work; we can scope it in Q1 planning.&rdquo;</div>
        <div className="line"><span className="pill ok">Answered</span><span className="muted">by Ken Watanabe, Platform</span></div>
      </>
    ),
  },
  {
    title: "The team picture stays current on its own",
    body: "Beacon learns from the answer. Anything about ownership or what a team can take on waits for one teammate to confirm it.",
    card: (
      <>
        <div>Learned: <i>merchant sign-on isn&apos;t supported yet; about three weeks of work.</i></div>
        <div className="line"><span className="pill warn">Waiting for Platform to confirm</span></div>
      </>
    ),
  },
];

const CASES = [
  {
    t: "Product and Engineering",
    d: "Find out what another team owns, what it's working on and whether it can help, before you plan around it.",
    l: ["What a team owns and who to ask", "Answers with sources, not hearsay"],
    icon: <path d="M4 7h16M4 12h10M4 17h7M17 14l3 3-3 3" />,
  },
  {
    t: "Teams that get asked a lot",
    d: "Platform, data, security and ops teams answer the same questions over and over.",
    l: ["The agent answers what the team has already said", "Everything else arrives in one queue, merged"],
    icon: <path d="M5 12h4l2-5 2 10 2-5h4" />,
  },
  {
    t: "New joiners",
    d: "Learn how the organization works without a month of asking around.",
    l: ["Every team's responsibilities in one place", "How each team prefers to be asked"],
    icon: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>,
  },
  {
    t: "Leaders",
    d: "See what each team owns and knows, and where questions get stuck between teams.",
    l: ["Which questions go unanswered, and where", "Teams' context, kept current without status reports"],
    icon: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
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
            <span className="eyebrow">Team context, answers and routing</span>
            <h1 className="h1">
              Know what every team does.
              <span className="second">Ask the ones who know.</span>
            </h1>
            <p className="lede">
              Beacon learns what each team does, owns and knows from its conversations and work. Every team gets an agent that answers
              questions with sources and sends the rest to the right person, so nobody has to chase contacts or keep a profile up to date.
            </p>
            <div className="hero-ctas">
              <Link className="btn btn-primary" href="/early-access">Request early access <Arrow /></Link>
              <a className="btn btn-ghost" href="#how-it-works">See how it works</a>
            </div>
            <p className="hero-note">Answers with sources. Questions that reach someone who can answer.</p>
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
            <h2 id="gap-title" className="h2" style={{ margin: "16px 0 24px" }}>Everyone knows their own team. Nobody knows the rest.</h2>
            <p>Every department has its own systems, priorities and workflows.</p>
            <p>Product lives in roadmaps. Engineering lives in code and tickets. Sales lives in the CRM. Operations lives in its own processes.</p>
            <p>But most questions are about another team. Who owns this? Can they help? Is this still true? How do they want to be asked?</p>
            <p>Today the answer means searching docs, scanning channels and messaging whoever might know, and still not being sure it&apos;s current.</p>
            <p className="pull">Beacon gives every team a picture others can understand, and a way to ask it.</p>
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
            <h2 id="product-title" className="h2">Understand any team, get a sourced answer, reach the right person.</h2>
          </Reveal>
          <div className="pillars">
            {[
              { n: "01", k: "Team context", t: "Learned, not maintained.", p: "Beacon builds each team's picture from its conversations, answers and work: what it owns, knows, runs and how to ask it. Teams only fix what's wrong.", g: "context" as const },
              { n: "02", k: "Grounded answers", t: "Every point shows its source.", p: "Each team's agent answers from that picture, at your level of access, and says whether a point was confirmed, learned, seen in a tool or inferred.", g: "coordinate" as const },
              { n: "03", k: "Routing", t: "The rest reaches someone who knows.", p: "What the agent can't answer goes to the owner or the team's queue. You see where it went, and the answer comes back to you.", g: "execute" as const },
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
            <h2 id="show-title" className="h2">See what a team knows, then ask it.</h2>
            <p className="lede">
              A team&apos;s picture, learned from its own conversations and tools, and answers drawn only from what each person is allowed to see.
            </p>
          </Reveal>
          <div className="window" style={{ marginBottom: 18 }}>
            <div className="window-bar">
              <div className="window-dots" aria-hidden="true"><i /><i /><i /></div>
              <span className="window-title">Platform · Northwind Labs</span>
              <span className="demo-label">Illustrative demo data</span>
            </div>
            <div style={{ padding: 16 }}>
              <div className="show-grid">
                <TeamPicture />
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
            <h2 id="flow-title" className="h2" style={{ marginTop: 16 }}>From a question to an answer you can trust.</h2>
            <p className="lede" style={{ marginTop: 18 }}>
              Beacon answers what it can from what the team has said and done, says what it doesn&apos;t know, and gets the rest to a person
              who does.
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
            <h2 id="cases-title" className="h2">For anyone who needs something from another team.</h2>
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
              The answer usually exists. It&apos;s just in <em>another team&apos;s head.</em>
            </p>
          </Reveal>
          <Reveal className="about-copy" delay={100}>
            <p>
              Much of the workday goes to finding out what other teams own, what they know and who to ask. The information exists in
              their conversations, tickets and code, but it doesn&apos;t reach the people who need it.
            </p>
            <p>
              Beacon builds a picture of each team from that activity, lets every team&apos;s agent answer from it with sources, and routes
              what it can&apos;t answer to the people who can. Teams don&apos;t fill in profiles; they correct what Beacon gets wrong.
            </p>
            <div className="not-list">
              <div><b>Learned, not maintained.</b><span>Context comes from the team&apos;s own conversations and work. Teams confirm, fix or remove it in one click.</span></div>
              <div><b>Answers come with sources.</b><span>Each point says where it came from and how fresh it is, and missing information is said out loud.</span></div>
              <div><b>Your access, never more.</b><span>An agent answering you reads only what you&apos;re allowed to see, and every read is logged.</span></div>
              <div><b>Answers, not actions.</b><span>Beacon answers and routes. It doesn&apos;t take on work or make promises for a team.</span></div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Final CTA */}
      <section className="final" aria-labelledby="final-title">
        <SignalField />
        <div className="wrap" style={{ position: "relative" }}>
          <span className="eyebrow">Early access</span>
          <h2 id="final-title" className="h2">Make every team easy to understand.</h2>
          <p>See what happens when anyone can ask any team, and get an answer with its sources.</p>
          <div className="hero-ctas">
            <Link className="btn btn-primary" href="/early-access">Request early access <Arrow /></Link>
            <Link className="btn btn-ghost" href="/feed">Try the interactive demo</Link>
          </div>
        </div>
      </section>
    </>
  );
}
