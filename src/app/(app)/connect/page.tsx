import { headers } from "next/headers";
import { currentViewer } from "@/lib/session";
import { Flash, Topbar } from "@/components/ui";
import { simulate } from "@/app/actions";

export default async function ConnectPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const { msg } = await searchParams;
  const { viewer } = await currentViewer();
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
      <Topbar crumbs={[viewer.user.name, "Connect tools"]} />
      <div className="content">
        <Flash msg={msg} />
        <div className="page-head">
          <div>
            <h1>Connect tools</h1>
            <p>Updates can start from work you already do. Each source creates a draft that only you can see. Nothing is shared until you review and publish it.</p>
          </div>
        </div>
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
