import { cookies, headers } from "next/headers";
import { currentViewer } from "@/lib/session";
import { Flash, LevelTag, Pill, Topbar } from "@/components/ui";
import { connectTool, issueCodingToken, revokeCodingToken, simulate, syncTool } from "@/app/actions";
import { attachGithubInstallation, mapGithubRepo } from "@/app/actions/github";
import { CATALOG, CONNECTOR_LABEL, recentSourceItems, teamConnectors } from "@/lib/integrations";
import { fmt, fmtDateTime } from "@/lib/clock";
import { aiStatus, usage } from "@/lib/ai/llm";
import {
  API_TOKEN_ONCE_COOKIE,
  demoApiToken,
  hookSettingsJson,
  isApiToken,
} from "@/lib/auth/api-tokens";
import { githubAppConfigured, githubAppInstallUrl } from "@/lib/github/app";

export default async function ConnectPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const { msg } = await searchParams;
  const { db, viewer, demo, isSample } = await currentViewer();
  const tools = await teamConnectors(db, viewer.team.id);
  const items = await recentSourceItems(db, viewer, viewer.team.id, 10);
  const available = CATALOG.filter((k) => !tools.some((t) => t.kind === k));
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`;
  const jar = await cookies();
  const once = jar.get(API_TOKEN_ONCE_COOKIE)?.value ?? "";
  if (once) jar.delete(API_TOKEN_ONCE_COOKIE);
  const prefix = typeof viewer.user.api_token_prefix === "string" ? viewer.user.api_token_prefix : "";
  const hasToken = !!viewer.user.api_token_hash || !!viewer.user.api_token || isApiToken(once);
  const revealToken = isSample ? demoApiToken(viewer.user.id) : isApiToken(once) ? once : "";
  const settings = revealToken ? hookSettingsJson(origin, revealToken) : null;
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
                          <td>
                            <div style={{ fontWeight: 500 }}>{t.name}</div>
                            <div className="small muted">{CONNECTOR_LABEL[t.kind] ?? t.kind}</div>
                            {t.mode === "live" ? <Pill tone="green">Live</Pill> : <Pill tone="gray">Demo</Pill>}
                          </td>
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
            <div className="row" style={{ gap: 8, margin: "12px 0", flexWrap: "wrap" }}>
              <Pill tone={hasToken || isSample ? "green" : "gray"}>{hasToken || isSample ? "Token active" : "No token"}</Pill>
              {!isSample && prefix && <span className="mono small muted">{prefix}…</span>}
              {isSample ? (
                <span className="small muted">Demo token for the sample workspace. Issue, rotate and revoke are personal in a real workspace.</span>
              ) : (
                <>
                  <form action={issueCodingToken}><button className="b sm" type="submit">{hasToken ? "Rotate token" : "Issue token"}</button></form>
                  {hasToken && (
                    <form action={revokeCodingToken}><button className="b sm" type="submit">Revoke</button></form>
                  )}
                </>
              )}
            </div>
            {settings ? (
              <ol style={{ margin: "10px 0 0", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 8 }}>
                <li>Copy <span className="mono">integrations/claude-code/relay-hook.mjs</span> from the Beacon repo to <span className="mono">~/.claude/hooks/</span>.</li>
                <li>
                  Add this to <span className="mono">~/.claude/settings.json</span>.
                  {isSample
                    ? ` This is ${viewer.user.name}'s demo token.`
                    : ` This is ${viewer.user.name}'s personal token. Copy it now. Revoke it anytime above.`}
                  <pre className="code">{settings}</pre>
                </li>
                <li>Finish a session. The draft shows up under Write update.</li>
              </ol>
            ) : hasToken ? (
              <p className="muted small">Token on file ({prefix}…). Rotate to see a new one.</p>
            ) : (
              <p className="muted small">Issue a personal token to see the hook install command.</p>
            )}
            <form action={simulate} style={{ marginTop: 12 }}>
              <input type="hidden" name="kind" value="session" />
              <button className="b bp" type="submit">Try it: simulate a session for {viewer.team.name}</button>
            </form>
          </section>
          <section className="card">
            <h2>GitHub App</h2>
            <p className="muted">
              Install the Beacon GitHub App on an org, map repositories to teams, and merged PRs plus reviews teach that team.
              Webhook URL (App or legacy):
            </p>
            <pre className="code">{`${origin}/api/sources/github`}</pre>
            {githubAppConfigured() ? (
              <div style={{ marginTop: 12 }}>
                {githubAppInstallUrl() && (
                  <p className="small muted" style={{ marginBottom: 8 }}>
                    <a href={githubAppInstallUrl()!}>Install on GitHub</a>, then attach the installation id here.
                  </p>
                )}
                <form action={attachGithubInstallation} className="row" style={{ gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                  <input name="installationId" placeholder="Installation id" required className="mono" style={{ minWidth: 140 }} />
                  <input name="accountLogin" placeholder="GitHub org/user" required style={{ minWidth: 140 }} />
                  <button className="b sm" type="submit">Attach install</button>
                </form>
                <form action={mapGithubRepo} className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  <input name="installationId" placeholder="Installation id" required className="mono" style={{ minWidth: 140 }} />
                  <input name="repo" placeholder="org/repo" required className="mono" style={{ minWidth: 160 }} />
                  <input type="hidden" name="unitId" value={viewer.team.id} />
                  <button className="b sm" type="submit">Map to {viewer.team.name}</button>
                </form>
              </div>
            ) : (
              <p className="small muted" style={{ marginTop: 8 }}>
                Set <span className="mono">GITHUB_APP_ID</span>, <span className="mono">GITHUB_APP_PRIVATE_KEY</span> and{" "}
                <span className="mono">GITHUB_APP_WEBHOOK_SECRET</span> (plus optional <span className="mono">GITHUB_APP_SLUG</span>) to enable installs.
                Legacy per-repo webhooks with <span className="mono">GITHUB_WEBHOOK_SECRET</span> still work.
              </p>
            )}
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
