// "A team's agent and its people": how answering splits between a team's agent and its people.
// Every claim here is something the prototype does; the thread is illustrative demo data.
import { Reveal } from "./Interactive";

const AGENT = [
  "Learns what the team owns, knows and runs from its conversations, answers and work",
  "Answers other teams' questions from that, with a source for every point, at the asker's level of access",
  "Says what it couldn't find, and asks a clarifying question instead of guessing",
  "Sends what it can't answer to the owner or the team's queue, merged with everyone who asked the same thing",
];

const PEOPLE = [
  "Answer once, for everyone who asked, instead of in scattered DMs",
  "Anyone on the team can pick up a question from the team's queue",
  "Confirm, fix or remove what Beacon learned, in one click",
  "Approve anything about ownership or what the team can take on before others see it",
];

const GUARDS = [
  { t: "Private answers stay private", d: "A reply goes to the people who asked. Only the general fact becomes team context." },
  { t: "People approve ownership claims", d: "Anything about what the team owns or can take on waits for one teammate." },
  { t: "Every read on the record", d: "Each read and answer is logged, with the person the agent acted for." },
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
          <span className="eyebrow">Agents</span>
          <h2 id="agents-title" className="h2">The team&apos;s agent answers. The team&apos;s people decide.</h2>
          <p className="lede">
            Every team has an agent as its first point of contact. People stay in charge of what gets said on the team&apos;s behalf.
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
                Platform hasn&apos;t said a date yet. I&apos;ve asked Aisha Bello, who owns rate limits. Three other people asked the
                same thing, so she&apos;ll answer once for everyone.
              </Msg>
              <Msg who="Aisha Bello" team="Platform" tags={<span className="pill ok">Sent to 4 people</span>}>
                Dec 9. The change is in review now.
              </Msg>
              <Msg who="Platform agent" team="Answers for Platform" agent>
                Aisha says Dec 9. I&apos;ve added it to what I know about Platform, so I can answer this next time, with her answer as the source.
              </Msg>
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
