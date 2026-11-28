import { workersEnabled } from "@/lib/flags";
import Link from "next/link";
import { currentViewer } from "@/lib/session";
import { chatContacts, conversation } from "@/lib/assistant";
import type { AgentRow } from "@/lib/agents";
import { chatSend } from "@/app/actions";
import { Avatar, Flash, Pill, Topbar } from "@/components/ui";
import { ChatThread } from "@/components/chat/ChatThread";
import { Composer } from "@/components/chat/Composer";
import { suggestionsFor } from "@/components/chat/Dock";
import { fmtDateTime } from "@/lib/clock";

function Contact({ a, active, last }: { a: AgentRow | null; active: boolean; last?: string }) {
  const id = a ? a.id : "me";
  const name = a ? a.name : "Your Beacon agent";
  return (
    <Link href={`/messages?with=${encodeURIComponent(id)}`} className="contact" aria-current={active ? "page" : undefined}>
      <Avatar name={name} agent size={30} />
      <span className="grow" style={{ minWidth: 0 }}>
        <span className="row" style={{ gap: 6 }}>
          <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
          {a && <Pill tone={a.tier === "worker" ? "violet" : "gray"} dot={false}>{a.tier === "worker" ? "Worker" : "Q&A"}</Pill>}
        </span>
        <span className="small muted" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {a ? `${a.team.name}${a.builtIn ? "" : " · teammate"}` : "Finds the right team for you"}{last ? ` · ${fmtDateTime(last)}` : ""}
        </span>
      </span>
    </Link>
  );
}

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ with?: string; msg?: string }> }) {
  const sp = await searchParams;
  const { db, viewer, demo } = await currentViewer();
  const { mine, others, lastAt } = await chatContacts(db, viewer);
  const all = [...mine, ...others];
  // "latest" opens the newest teammate on your teams, for links that follow creating one.
  const latest = sp.with === "latest" ? mine.filter((a) => !a.builtIn).at(-1) : undefined;
  const agent = latest ?? all.find((a) => a.id === sp.with) ?? null;
  const target = agent ? agent.id : "me";
  const messages = await conversation(db, viewer, target, 60);
  const name = agent ? agent.name : "Your Beacon agent";

  return (
    <>
      <Topbar crumbs={["Messages"]}>
        {workersEnabled() && (<div className="actions"><Link href="/agents/new" className="b bp sm">+ New teammate</Link></div>)}
      </Topbar>
      <div className="chat-page">
        <nav className="contacts" aria-label="Conversations">
          <Contact a={null} active={target === "me"} last={lastAt.get("me")} />
          <div className="section">Your teams&apos; agents</div>
          {mine.map((a) => <Contact key={a.id} a={a} active={a.id === target} last={lastAt.get(a.id)} />)}
          <div className="section">Other teams&apos; agents</div>
          {others.map((a) => <Contact key={a.id} a={a} active={a.id === target} last={lastAt.get(a.id)} />)}
        </nav>
        <section className="chat-main">
          <Flash msg={sp.msg} />
          <div className="chat-main-head">
            <Avatar name={name} agent size={36} />
            <div className="grow">
              <div style={{ fontWeight: 600, fontSize: 15 }}>{name}</div>
              <div className="small muted">
                {agent ? agent.purpose : "Ask about any team's work. I find who owns it, answer from what they published at your level of access, and route anything new to the owner."}
              </div>
            </div>
            {agent && <Link className="b sm" href={`/agents/${agent.team.slug}${agent.builtIn ? "" : `?agent=${agent.id}`}`}>Profile</Link>}
          </div>
          <div className="chat-scroll page">
            <ChatThread
              messages={messages}
              me={viewer.user.name}
              empty={<p className="muted" style={{ margin: 0 }}>No messages yet. Try one of the suggestions below, or type @ and an agent&apos;s name.</p>}
            />
          </div>
          <Composer action={chatSend} target={target} from="page" placeholder={`Message ${name}`} suggestions={suggestionsFor(agent, viewer, demo)} />
        </section>
      </div>
    </>
  );
}
