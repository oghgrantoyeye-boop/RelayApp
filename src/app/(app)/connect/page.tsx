import { headers } from "next/headers";
import { currentViewer } from "@/lib/session";
import { Flash, LevelTag, Pill, Topbar } from "@/components/ui";
import { connectTool, simulate, syncTool } from "@/app/actions";
import { CATALOG, CONNECTOR_LABEL, recentSourceItems, teamConnectors } from "@/lib/integrations";
import { fmt, fmtDateTime } from "@/lib/clock";
import { aiStatus, usage } from "@/lib/ai/llm";

export default async function ConnectPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const { msg } = await searchParams;
  const { db, viewer, demo } = await currentViewer();
  const tools = await teamConnectors(db, viewer.team.id);
  const items = await recentSourceItems(db, viewer, viewer.team.id, 10);
  const available = CATALOG.filter((k) => !tools.some((t) => t.kind === k));
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`;
  const settings = JSON.stringify(
    {
      hooks: {
        SessionEnd: [
          { hooks: [{ type: "command", command: `RELAY_URL=${origin} RELAY_TOKEN=${viewer.user.api_token} node ~/.claude/hooks/relay-hook.mjs` }] },
        ],
      },
    },
    null,
    2,
  );
  return (
    <>
      <Topbar crumbs={[viewer.team.name, "Integrations"]} />
      <div className="content">
        <Flash msg={msg} />
        <div className="page-head">
          <div>
            <h1>Integrations</h1>
            <p>
              The tools {viewer.team.name} works in. {viewer.team.name}&apos;s agent reads them to answer questions and draft updates. Their content stays
              inside your team; other teams see only what an interface shares, and never raw chat.
            </p>
          </div>
        </div>
        <AiCard />
        <div className="notice warn" style={{ marginBottom: 16 }}>Demo: these connections hold {demo.org.name}&apos;s fictional data. Claude Code and GitHub below are real integrations.</div>
        <div className="two" style={{ marginBottom: 28 }}>
          <section className="primary">
            <div>
              <h2>{viewer.team.name}&apos;s connected tools ({tools.length})</h2>
              {tools.length === 0 ? (
                <div className="card empty">No tools connected yet.</div>
              ) : (
                <div className="tablewrap">
                  <table>
                    <thead><tr><th>Tool</th><th>Synced items</th><th>Last sync (UTC)</th><th>Connected by</th><th /></tr></thead>
                    <tbody>
                      {tools.map((t) => (
                        <tr key={t.id}>
                          <td><div style={{ fontWeight: 500 }}>{t.name}</div><div className="small muted">{CONNECTOR_LABEL[t.kind] ?? t.kind}</div></td>
                          <td className="mono">{t.items + t.meetings}</td>
                          <td className="mono">{t.last_sync_at ? fmtDateTime(t.last_sync_at) : "never"}</td>
                          <td>{t.connected_by_name ?? "–"}</td>
                          <td>
                            <form action={syncTool}><input type="hidden" name="id" value={t.id} /><button className="b sm">Sync now</button></form>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div>
              <h2>Recently synced</h2>
              {items.length === 0 ? (
                <div className="card empty">Nothing synced yet.</div>
              ) : (
                <ul className="list card tight">
                  {items.map(({ row, shown }) => (
                    <li key={row.id}>
                      <span className="lead-col"><Pill tone="gray" dot={false}>{CONNECTOR_LABEL[row.connector_kind] ?? row.connector_kind}</Pill></span>
                      <div className="grow">
                        <div style={{ fontWeight: 500 }}>{shown.title}{shown.status && <span className="muted" style={{ fontWeight: 400 }}> · {shown.status}</span>}</div>
                        {shown.text && <div className="muted small" style={{ marginTop: 2 }}>{shown.text}</div>}
                        <div className="small muted row" style={{ gap: 6, marginTop: 4 }}>{fmt(row.occurred_at)} <LevelTag level={shown.level} /></div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
          <aside>
            <section>
              <h2>Add a tool</h2>
              <p className="small muted" style={{ marginBottom: 10 }}>In the demo, connecting a tool records the connection. A pilot connects your real workspace.</p>
              <div className="row">
                {available.map((k) => (
                  <form key={k} action={connectTool}>
                    <input type="hidden" name="kind" value={k} />
                    <button className="b sm" type="submit">+ {CONNECTOR_LABEL[k]}</button>
                  </form>
                ))}
              </div>
            </section>
          </aside>
        </div>
        <h2 style={{ marginBottom: 10 }}>Your own tools</h2>
        <div className="stack">
          <section className="card">
            <h2>Coding agents (Claude Code)</h2>
            <p className="muted">When a session ends, a small hook sends Beacon what you asked for, the agent&apos;s closing notes and your recent commits. Beacon drafts &ldquo;what I worked on&rdquo; and strips anything that looks like a secret.</p>
            <ol style={{ margin: "10px 0 0", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 8 }}>
              <li>Copy <span className="mono">integrations/claude-code/relay-hook.mjs</span> from the Beacon repo to <span className="mono">~/.claude/hooks/</span>.</li>
              <li>
                Add this to <span className="mono">~/.claude/settings.json</span>. The token is {viewer.user.name}&apos;s demo token.
                <pre className="code">{settings}</pre>
              </li>
              <li>Finish a session. The draft shows up under Write update.</li>
            </ol>
            <form action={simulate} style={{ marginTop: 12 }}>
              <input type="hidden" name="kind" value="session" />
              <button className="b bp" type="submit">Try it: simulate a session for {viewer.team.name}</button>
            </form>
          </section>
          <section className="card">
            <h2>GitHub pull requests</h2>
            <p className="muted">Merged pull requests become draft progress items for the author&apos;s team. Point a repository webhook at the URL below, content type JSON, &ldquo;Pull requests&rdquo; events. Set <span className="mono">GITHUB_WEBHOOK_SECRET</span> to verify signatures.</p>
            <pre className="code">{`${origin}/api/sources/github`}</pre>
            <p className="small muted" style={{ marginTop: 6 }}>People are matched by GitHub login. {viewer.user.name}&apos;s is <span className="mono">{viewer.user.github_login}</span>.</p>
            <form action={simulate} style={{ marginTop: 12 }}>
              <input type="hidden" name="kind" value="pr" />
              <button className="b" type="submit">Try it: simulate a merged pull request</button>
            </form>
          </section>
          <section className="card">
            <h2>Meeting notes</h2>
            <p className="muted">Paste notes or a transcript summary into Write update and choose &ldquo;Meeting notes&rdquo;. Decisions and promises are routed to people who weren&apos;t there. Zoom, Meet and Teams transcripts come next.</p>
          </section>
        </div>
      </div>
    </>
  );
}

/** Which model answers on this server, and whether its calls are working. */
function AiCard() {
  const ai = aiStatus();
  return (
    <section className="card" aria-label="AI model" style={{ marginBottom: 16 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <div style={{ fontWeight: 600 }}>AI model</div>
          <div className="small muted">
            {ai.provider === "claude"
              ? `Claude (${ai.model}) answers questions, splits updates and summarizes meetings.`
              : ai.provider === "offline"
                ? `Offline writer: answers are built from matching text, without a model. ${ai.reason} Add ANTHROPIC_API_KEY to the server's environment to use Claude.`
                : `${ai.model} (tests).`}
          </div>
        </div>
        <Pill tone={ai.provider === "claude" ? (usage.lastError && usage.failures > usage.calls ? "amber" : "green") : "gray"}>
          {ai.provider === "claude" ? "Connected" : "Offline"}
        </Pill>
      </div>
      {ai.provider === "claude" && (
        <div className="small muted" style={{ marginTop: 8 }}>
          Since this server started: {usage.calls} {usage.calls === 1 ? "call" : "calls"}, {usage.inputTokens.toLocaleString("en-US")} input and{" "}
          {usage.outputTokens.toLocaleString("en-US")} output tokens
          {usage.failures > 0 && `, ${usage.failures} fell back to the offline writer (last: ${usage.lastError})`}.
        </div>
      )}
    </section>
  );
}
