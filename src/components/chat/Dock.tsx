import { workersEnabled } from "@/lib/flags";
import Link from "next/link";
import { cookies } from "next/headers";
import type { Db } from "@/lib/db";
import type { Viewer } from "@/lib/data";
import type { DemoPack } from "@/lib/demos";
import { chatContacts, conversation } from "@/lib/assistant";
import type { AgentRow } from "@/lib/agents";
import { DOCK_COOKIE, DOCK_OPEN_COOKIE } from "@/lib/session";
import { chatSend, setDockTarget } from "@/app/actions";
import { Avatar, Pill } from "@/components/ui";
import { ChatThread } from "./ChatThread";
import { Composer } from "./Composer";
import { DockShell } from "./DockShell";
import { TargetPicker } from "./TargetPicker";

export function suggestionsFor(agent: AgentRow | null, viewer: Viewer, demo: DemoPack): string[] {
  if (!agent) {
    const first = Object.values(demo.ui.askExamples)[0];
    return ["What changed for me this week?", first, "What do we owe other teams?"].filter(Boolean) as string[];
  }
  const mine = viewer.reader.unitIds.includes(agent.team.id);
  const out: string[] = [];
  const t = demo.agentTemplate;
  if (mine && !agent.builtIn && agent.team.id === t.team && agent.name.replace(/ agent$/, "") === t.name.replace(/ agent$/, "")) out.push(t.firstJob);
  if (mine && agent.actions.includes("documents") && out.length === 0) out.push("Review the latest document");
  if (mine && agent.actions.includes("code") && out.length === 0) out.push("Fix the flaky load test");
  if (mine && agent.actions.includes("draft_update")) out.push("Draft our weekly update");
  if (mine && agent.actions.includes("research") && !agent.builtIn) out.push(`Research: ${demo.ui.researchHint}`);
  if (agent.actions.includes("answer") && demo.ui.askExamples[agent.team.id]) out.push(demo.ui.askExamples[agent.team.id]);
  return out.slice(0, 3);
}

/** The agent panel on every page. */
export async function Dock({ db, viewer, demo }: { db: Db; viewer: Viewer; demo: DemoPack }) {
  const jar = await cookies();
  const open = jar.get(DOCK_OPEN_COOKIE)?.value !== "closed";
  const { mine, others } = await chatContacts(db, viewer);
  const all = [...mine, ...others];
  let target = jar.get(DOCK_COOKIE)?.value ?? "me";
  const agent = all.find((a) => a.id === target) ?? null;
  if (!agent) target = "me";
  const messages = await conversation(db, viewer, target, 30);
  const names = Object.fromEntries(all.map((a) => [a.id, a.name]));
  const title = agent ? agent.name : "Your Beacon agent";
  const sub = agent
    ? `${agent.team.name} · ${agent.builtIn ? "built in" : "teammate"}`
    : "Asks the right team for you, at your level of access";

  return (
    <DockShell initialOpen={open}>
      <div className="dock-head">
        <div className="row" style={{ gap: 9 }}>
          <Avatar name={title} agent size={30} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{title} {agent && <Pill tone={agent.tier === "worker" ? "violet" : "gray"}>{agent.tier === "worker" ? "Worker" : "Q&A"}</Pill>}</div>
            <div className="small muted">{sub}</div>
          </div>
        </div>
        <TargetPicker
          current={target}
          action={setDockTarget}
          groups={[
            { label: "Your teams' agents", agents: mine.map((a) => ({ id: a.id, name: a.name })) },
            { label: "Other teams' agents", agents: others.map((a) => ({ id: a.id, name: a.name })) },
          ]}
        />
      </div>
      <div className="chat-scroll">
        <ChatThread
          scope="dock"
          messages={messages}
          me={viewer.user.name}
          empty={
            <>
              <p style={{ margin: "0 0 6px", fontWeight: 500 }}>{agent ? `Message ${agent.name}` : `Hi ${String(viewer.user.name).split(" ")[0]}. Ask me anything about the work.`}</p>
              <p className="small muted" style={{ margin: 0 }}>
                {agent
                  ? agent.purpose
                  : "I find the team that owns it, answer from what they've published at your level of access, and send anything new to the right person. Type @ and an agent's name to talk to it directly."}
              </p>
            </>
          }
        />
      </div>
      <Composer agentLabel={title} action={chatSend} target={target} from="dock" names={names} placeholder={agent ? `Message ${agent.name}` : "Ask, or @mention an agent"} suggestions={messages.length === 0 ? suggestionsFor(agent, viewer, demo) : undefined} />
      <div className="dock-foot small">
        <Link href={`/messages?with=${encodeURIComponent(target)}`}>Open full chat</Link>
        {workersEnabled() && <Link href="/agents/new">+ New teammate</Link>}
      </div>
    </DockShell>
  );
}
