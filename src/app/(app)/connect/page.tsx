import { cookies, headers } from "next/headers";
import { currentViewer } from "@/lib/session";
import { Flash, LevelTag, Pill, Topbar } from "@/components/ui";
import { connectTool, issueCodingToken, revokeCodingToken, setAiBudget, simulate, syncTool } from "@/app/actions";
import { mapGithubRepo, startGithubAppInstall } from "@/app/actions/github";
import { CATALOG, CONNECTOR_LABEL, recentSourceItems, teamConnectors } from "@/lib/integrations";
import { fmt, fmtDateTime } from "@/lib/clock";
import { aiStatus, usage } from "@/lib/ai/llm";
import { canSetBudget, capResetsAt, monthSpend } from "@/lib/ai/spend";
import {
  API_TOKEN_ONCE_COOKIE,
  demoApiToken,
  connectCommand,
  isApiToken,
} from "@/lib/auth/api-tokens";
import { githubAppConfigured } from "@/lib/github/app";

export default async function ConnectPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const { msg } = await searchParams;
  const { db, viewer, demo, account, isSample, orgId } = await currentViewer();
  const canEditBudget = await canSetBudget(db, account?.id, orgId, isSample);
  const installs = isSample
    ? []
    : await db.query(
        `select installation_id, account_login from github_installation where org_id = $1 order by created_at`,
        [viewer.orgId],
      );
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
  const command = revealToken ? connectCommand(origin, revealToken) : null;
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
        <AiCard orgId={orgId} canEdit={canEditBudget} />
        {isSample && <div className="notice warn" style={{ marginBottom: 16 }}>Demo: these connections hold {demo.org.name}&apos;s fictional data. Claude Code and GitHub below are real integrations.</div>}
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
            <h2>Coding agents (Claude Code, Codex, Cursor)</h2>
            <p className="muted">
              When your coding agent finishes a session or a turn, Beacon gets what you asked for, the agent&apos;s closing notes and your recent commits.
              Never code, diffs or files. It keeps one draft for you per day, grouped by repo, and strips anything that looks like a secret. Nothing is shared until you publish it.
            </p>
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
            {command ? (
              <ol style={{ margin: "10px 0 0", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 8 }}>
                <li>
                  Run this in a terminal on your computer. It needs Node 18 or later.
                  {isSample
                    ? ` This is ${viewer.user.name}'s demo token.`
                    : ` It holds ${viewer.user.name}'s personal token, so copy it now. Revoke it anytime above.`}
                  <pre className="code" style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{command}</pre>
                  <span className="small muted">It saves the token in ~/.beacon/config.json, readable only by you, and adds Beacon to Claude Code, Codex and Cursor if it finds them. Your other hooks stay as they are.</span>
                </li>
                <li>Restart any agent that was open, then work as usual. Claude Code reports when a session ends; Codex and Cursor after each turn.</li>
                <li>Today&apos;s draft shows up under Write update. Check the connection with <span className="mono">node ~/.beacon/beacon.mjs status</span>, or remove it with <span className="mono">node ~/.beacon/beacon.mjs disconnect</span>.</li>
              </ol>
            ) : hasToken ? (
              <p className="muted small">Token on file ({prefix}…). Rotate to see the connect command with a new token.</p>
            ) : (
              <p className="muted small">Issue a personal token to see the one command that connects your coding agents.</p>
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
            <p className="small muted" style={{ marginTop: 6 }}>
              Setup URL for the App: <span className="mono">{`${origin}/api/sources/github/setup`}</span>
            </p>
            {isSample ? (
              <p className="small muted" style={{ marginTop: 8 }}>
                Sample workspaces use the simulate button below. Real GitHub App installs are for signed-in workspace owners.
              </p>
            ) : githubAppConfigured() ? (
              <div style={{ marginTop: 12 }}>
                <p className="small muted" style={{ marginBottom: 8 }}>
                  Enable &ldquo;Request user authorization (OAuth) during installation&rdquo; on the App. Install starts from Beacon so we can verify you own the install.
                </p>
                <form action={startGithubAppInstall} style={{ marginBottom: 8 }}>
                  <button className="b sm" type="submit">Install on GitHub</button>
                </form>
                {installs.length > 0 && (
                  <p className="small muted" style={{ marginBottom: 8 }}>
                    Attached: {installs.map((i) => `${i.account_login} (#${i.installation_id})`).join(", ")}
                  </p>
                )}
                <form action={mapGithubRepo} className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  <input name="installationId" placeholder="Installation id" required className="mono" style={{ minWidth: 140 }} defaultValue={String(installs[0]?.installation_id ?? "")} />
                  <input name="repo" placeholder="org/repo" required className="mono" style={{ minWidth: 160 }} />
                  <input type="hidden" name="unitId" value={viewer.team.id} />
                  <button className="b sm" type="submit">Map to {viewer.team.name}</button>
                </form>
              </div>
            ) : (
              <p className="small muted" style={{ marginTop: 8 }}>
                Set <span className="mono">GITHUB_APP_ID</span>, <span className="mono">GITHUB_APP_PRIVATE_KEY</span>,{" "}
                <span className="mono">GITHUB_APP_WEBHOOK_SECRET</span>, <span className="mono">GITHUB_APP_CLIENT_ID</span>,{" "}
                <span className="mono">GITHUB_APP_CLIENT_SECRET</span> (plus optional <span className="mono">GITHUB_APP_SLUG</span>) to enable installs.
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
async function AiCard({ orgId, canEdit }: { orgId: string; canEdit: boolean }) {
  const ai = aiStatus();
  const { db } = await currentViewer();
  const spend = await monthSpend(db, orgId);
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
      <div className="row" style={{ marginTop: 10, gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <span>
          <strong>This month: ${spend.usd.toFixed(2)}</strong>
          {spend.cap !== null ? ` of a $${spend.cap} budget` : " (no budget set)"} · {spend.calls} {spend.calls === 1 ? "call" : "calls"}
        </span>
        {spend.capped && <Pill tone="amber">Budget reached</Pill>}
        {canEdit && (
          <form action={setAiBudget} className="row" style={{ gap: 6 }}>
            <label className="small muted" htmlFor="ai-budget">Monthly budget, $</label>
            <input id="ai-budget" type="number" name="usd" min={0} step={1} defaultValue={spend.cap ?? ""} placeholder="No limit" style={{ width: 100 }} />
            <button className="b sm" type="submit">Save</button>
          </form>
        )}
      </div>
      {spend.capped && (
        <div className="small muted" style={{ marginTop: 6 }}>
          This workspace reached its budget, so answers, splits and summaries use the offline writer until {fmt(capResetsAt())}.{canEdit ? " Raise the budget to switch back now." : " A workspace admin can raise it."}
        </div>
      )}
    </section>
  );
}
