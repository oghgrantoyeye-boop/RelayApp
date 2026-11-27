// "Agents and people, side by side": how the work splits between a team's agent and its people.
// Every claim here is something the prototype does; the thread is illustrative demo data.
import { Reveal } from "./Interactive";

const AGENT = [
  "Answers questions from what the team has already shared, at the asker's level of access",
  "Routes what it can't answer to the person who owns it, merged with everyone who asked the same thing",
  "Does the legwork: research, and draft updates from tickets, pull requests and meetings",
  "Follows up on commitments and tells the teams affected when one slips",
];

const PEOPLE = [
  "Make the decisions and own the commitments",
  "Answer once, in a batch, instead of across scattered emails and DMs",
  "Review and approve before anything is shared with other teams",
  "Comment on, redirect or take over an agent's work at any time",
];

const GUARDS = [
  { t: "Never more than you can see", d: "An agent working for you reads only what you're allowed to read." },
  { t: "Agents draft, people publish", d: "Nothing an agent writes reaches another team until a person approves it." },
  { t: "Every action on the record", d: "Each read and answer is logged, with the person the agent acted for." },
  { t: "A budget per agent", d: "Each agent works within a monthly spending limit, shown to its team." },
];

function Msg({ who, team, agent, children, tags }: { who: string; team: string; agent?: boolean; children: React.ReactNode; tags?: React.ReactNode }) {
  return (
    <div className={`msg${agent ? " agent" : ""}`}>
      <span className={`av${agent ? " agent" : ""}`} aria-hidden="true">{agent ? "AI" : who.split(" ").map((p) => p[0]).join("")}</span>
      <div className="msg-body">
        <div className="msg-who">
          <b>{who}</b>
          <span>{team}</span>
        </div>
        <div className="msg-text">{children}</div>
        {tags && <div className="msg-tags">{tags}</div>}
      </div>
    </div>
  );
}

export function SideBySide() {
  return (
    <section className="section band" id="agents" aria-labelledby="agents-title">
      <div className="wrap">
        <Reveal className="section-head">
          <span className="eyebrow">People and agents</span>
          <h2 id="agents-title" className="h2">Agents and people, side by side.</h2>
          <p className="lede">
            Every team has an agent as its first point of contact. It answers what the team has already shared, does the work it&apos;s asked
            to do and hands everything else to the person who owns it. People stay in charge of what gets decided and what gets shared.
          </p>
        </Reveal>
        <div className="sbs">
          <div className="sbs-cols">
            <Reveal className="sbs-col">
              <h3 className="sbs-h"><span className="av agent" aria-hidden="true">AI</span>The team&apos;s agent</h3>
              <ul>{AGENT.map((x) => <li key={x}>{x}</li>)}</ul>
            </Reveal>
            <Reveal className="sbs-col" delay={90}>
              <h3 className="sbs-h"><span className="av" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>
              </span>The team&apos;s people</h3>
              <ul>{PEOPLE.map((x) => <li key={x}>{x}</li>)}</ul>
            </Reveal>
          </div>
          <Reveal className="window thread" delay={120}>
            <div className="window-bar">
              <div className="window-dots" aria-hidden="true"><i /><i /><i /></div>
              <span className="window-title">Platform agent</span>
              <span className="demo-label">Illustrative demo data</span>
            </div>
            <div className="thread-body">
              <Msg who="Ravi Shah" team="Growth">When will the rate-limit change land?</Msg>
              <Msg who="Platform agent" team="Answers for Platform" agent tags={<><span className="pill info">Routed to owner</span><span className="pill info">Merged with 3 others</span></>}>
                Platform hasn&apos;t shared a new date yet. I&apos;ve asked Aisha Bello, who owns rate limits. Three other people asked the
                same thing, so she&apos;ll answer once for everyone.
              </Msg>
              <Msg who="Aisha Bello" team="Platform" tags={<span className="pill ok">Sent to 4 people</span>}>
                Dec 9. The change is in review now.
              </Msg>
              <Msg who="Platform agent" team="Answers for Platform" agent>
                Aisha says Dec 9. I&apos;ll answer this myself next time, and I&apos;ll tell you if the date moves.
              </Msg>
              <div className="task-line">
                <span className="pill warn">Working</span>
                <span>Research for Marcus: how other payment APIs limit webhook retries · 6 sources so far</span>
              </div>
            </div>
          </Reveal>
        </div>
        <ul className="guards">
          {GUARDS.map((g) => (
            <li key={g.t}>
              <b>{g.t}</b>
              <span>{g.d}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
