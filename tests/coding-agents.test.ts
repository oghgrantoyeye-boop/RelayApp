// Local coding agents (T-63): reports from Claude Code, Codex and Cursor build one rolling draft per
// person per day, and beacon.mjs sets up each agent without touching other hooks. No network, no
// real model: the fake model falls back to the offline writer.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { openDb, migrate, type Db } from "@/lib/db";
import { seed } from "@/lib/seed";
import { setNow } from "@/lib/clock";
import { FakeLLM, setLLM } from "@/lib/ai/llm";
import { loadViewer, type Viewer } from "@/lib/data";
import { ingestCodingSession } from "@/lib/sources";
import { DEFAULT_DEMO } from "@/lib/demos";
import { scoped } from "@/lib/scoped";

const sid = (id: string) => scoped(DEFAULT_DEMO, id);
let db: Db;
const v = async (id: string): Promise<Viewer> => (await loadViewer(db, sid(id), DEFAULT_DEMO))!;

describe("rolling coding-agent drafts", () => {
  beforeEach(async () => {
    setNow("2026-12-06T09:00:00Z");
    setLLM(new FakeLLM({}));
    db = await openDb({});
    await migrate(db);
    await seed(db);
  });

  it("merges every turn and session from one day into one draft, with items per repo", async () => {
    const hannah = await v("hannah");
    const a = await ingestCodingSession(db, hannah, { tool: "codex", session_id: "t1", repo: "northwind/payments-api", branch: "feat/retries", prompts: ["Add backoff to retries"], notes: ["Added the retry scheduler."], commits: ["abc1234 Add retry scheduler"] });
    const b = await ingestCodingSession(db, hannah, { tool: "codex", session_id: "t1", repo: "northwind/payments-api", branch: "feat/retries", prompts: ["Now add jitter"], notes: ["Jitter added."], commits: ["def5678 Add jitter"] });
    const c = await ingestCodingSession(db, hannah, { tool: "cursor", session_id: "conv-9", repo: "northwind/web", branch: "main", prompts: ["Fix the checkout button"], notes: ["Fixed."] });
    expect(b.updateId).toBe(a.updateId);
    expect(c.updateId).toBe(a.updateId);

    const sessions = await db.query(`select * from coding_session where update_id = $1 order by created_at, id`, [a.updateId]);
    expect(sessions).toHaveLength(2);
    expect(sessions[0].prompts).toEqual(["Add backoff to retries", "Now add jitter"]);

    const items = await db.query(`select source_ref, status from update_item where update_id = $1`, [a.updateId]);
    expect(new Set(items.map((i) => i.source_ref))).toEqual(new Set(["northwind/payments-api", "northwind/web"]));
    expect(items.every((i) => i.status === "draft")).toBe(true);

    const draft = (await db.one(`select body_md, status from team_update where id = $1`, [a.updateId]))!;
    expect(draft.status).toBe("draft");
    expect(draft.body_md).toContain("Codex in northwind/payments-api (feat/retries)");
    expect(draft.body_md).toContain("- def5678 Add jitter");
    expect(draft.body_md).toContain("Cursor in northwind/web (main)");
  });

  it("starts a new draft once today's is published, without repeating what was shared", async () => {
    const hannah = await v("hannah");
    const a = await ingestCodingSession(db, hannah, { tool: "claude_code", session_id: "s1", repo: "northwind/payments-api", branch: "x", prompts: ["First thing"] });
    await db.query(`update team_update set status = 'published' where id = $1`, [a.updateId]);
    const b = await ingestCodingSession(db, hannah, { tool: "claude_code", session_id: "s1", repo: "northwind/payments-api", branch: "x", prompts: ["Second thing"] });
    expect(b.updateId).not.toBe(a.updateId);
    const s = (await db.one(`select prompts, update_id from coding_session where session_key = 's1'`))!;
    expect(s.update_id).toBe(b.updateId);
    expect(s.prompts).toEqual(["Second thing"]);
  });

  it("starts a new draft the next day", async () => {
    const hannah = await v("hannah");
    const a = await ingestCodingSession(db, hannah, { repo: "northwind/payments-api", prompts: ["Monday work"] });
    setNow("2026-12-07T09:00:00Z");
    const b = await ingestCodingSession(db, hannah, { repo: "northwind/payments-api", prompts: ["Tuesday work"] });
    expect(b.updateId).not.toBe(a.updateId);
  });
});

// ---------- beacon.mjs on a fake home directory ----------

// beacon.mjs is plain JavaScript that runs on people's computers, so it has no types.
type Json = Record<string, unknown>;
interface Cli {
  installClaude(): string;
  uninstallClaude(): boolean;
  installCodex(config: Json): string;
  uninstallCodex(config: Json): boolean;
  installCursor(): string;
  uninstallCursor(): boolean;
  buildReport(tool: string, input: Json, cwd: string): Json | null;
  cursorHook(input: Json): Promise<Json>;
}
let home: string;
let cli: Cli;

beforeAll(async () => {
  home = mkdtempSync(path.join(os.tmpdir(), "beacon-home-"));
  process.env.BEACON_HOME_DIR = home;
  process.env.BEACON_NO_MAIN = "1";
  // @ts-expect-error: no declaration file for a plain .mjs script
  cli = (await import("../public/beacon.mjs")) as Cli;
});
afterAll(() => rmSync(home, { recursive: true, force: true }));

const read = (rel: string) => readFileSync(path.join(home, rel), "utf8");
const write = (rel: string, text: string) => {
  mkdirSync(path.dirname(path.join(home, rel)), { recursive: true });
  writeFileSync(path.join(home, rel), text);
};

describe("beacon.mjs", () => {
  it("adds Claude Code's hook, keeps other hooks and replaces the old Relay hook", () => {
    write(".claude/settings.json", JSON.stringify({
      model: "opus",
      hooks: {
        SessionEnd: [
          { hooks: [{ type: "command", command: "RELAY_TOKEN=x node ~/.claude/hooks/relay-hook.mjs" }] },
          { hooks: [{ type: "command", command: "say done" }] },
        ],
        Stop: [{ hooks: [{ type: "command", command: "echo stop" }] }],
      },
    }));
    cli.installClaude();
    cli.installClaude(); // twice is the same as once
    const s = JSON.parse(read(".claude/settings.json"));
    expect(s.model).toBe("opus");
    expect(s.hooks.Stop).toHaveLength(1);
    const commands = s.hooks.SessionEnd.flatMap((g: { hooks: { command: string }[] }) => g.hooks.map((h) => h.command));
    expect(commands).toHaveLength(2);
    expect(commands).toContain("say done");
    expect(commands.some((c: string) => c.includes(".beacon/beacon.mjs") && c.endsWith("hook claude"))).toBe(true);
    expect(commands.some((c: string) => c.includes("relay-hook"))).toBe(false);

    cli.uninstallClaude();
    const after = JSON.parse(read(".claude/settings.json"));
    expect(after.hooks.SessionEnd).toEqual([{ hooks: [{ type: "command", command: "say done" }] }]);
  });

  it("sets Codex's notify, keeps an earlier notify command and restores it on disconnect", () => {
    write(".codex/config.toml", 'notify = ["terminal-notifier", "-title", "Codex"]\nmodel = "gpt-5"\n\n[tui]\nnotifications = true\n');
    const config: Record<string, unknown> = {};
    cli.installCodex(config);
    const toml = read(".codex/config.toml");
    expect(toml.split("\n")[0]).toMatch(/^notify = \["node",".*beacon\.mjs","hook","codex"\]$/);
    expect(toml).toContain("[tui]");
    expect(config.codexPreviousNotify).toEqual(["terminal-notifier", "-title", "Codex"]);
    cli.installCodex(config); // again: still one notify, earlier command still kept
    expect(read(".codex/config.toml").match(/^notify/gm)).toHaveLength(1);
    expect(config.codexPreviousNotify).toEqual(["terminal-notifier", "-title", "Codex"]);

    cli.uninstallCodex(config);
    expect(read(".codex/config.toml").split("\n")[0]).toBe('notify = ["terminal-notifier","-title","Codex"]');
  });

  it("adds notify above Codex's tables when there was none", () => {
    write(".codex/config.toml", '[profiles.work]\nmodel = "o3"\n');
    cli.installCodex({});
    const lines = read(".codex/config.toml").split("\n");
    expect(lines[0]).toMatch(/^notify = /);
    cli.uninstallCodex({});
    expect(read(".codex/config.toml")).toBe('[profiles.work]\nmodel = "o3"\n');
  });

  it("adds Cursor's hooks next to existing ones", () => {
    write(".cursor/hooks.json", JSON.stringify({ version: 1, hooks: { stop: [{ command: "./hooks/audit.sh" }] } }));
    cli.installCursor();
    const h = JSON.parse(read(".cursor/hooks.json"));
    expect(h.hooks.stop.map((x: { command: string }) => x.command)).toEqual(["./hooks/audit.sh", expect.stringContaining("hook cursor")]);
    expect(h.hooks.beforeSubmitPrompt).toHaveLength(1);
    expect(h.hooks.afterAgentResponse).toHaveLength(1);
    cli.uninstallCursor();
    expect(JSON.parse(read(".cursor/hooks.json"))).toEqual({ version: 1, hooks: { stop: [{ command: "./hooks/audit.sh" }] } });
  });

  it("builds a Codex report from its notify payload", () => {
    const r = cli.buildReport("codex", {
      type: "agent-turn-complete",
      "thread-id": "th_1",
      "input-messages": ["Rename the config loader", "<environment_context>…</environment_context>"],
      "last-assistant-message": "Renamed it and updated the imports.",
      cwd: home,
    }, home);
    expect(r).toMatchObject({ tool: "codex", session_id: "th_1", prompts: ["Rename the config loader"], notes: ["Renamed it and updated the imports."] });
    expect(cli.buildReport("codex", { type: "something-else" }, home)).toBeNull();
  });

  it("collects Cursor's prompt and reply until the turn stops", async () => {
    expect(await cli.cursorHook({ hook_event_name: "beforeSubmitPrompt", conversation_id: "c1", prompt: "Add a dark mode" })).toEqual({ continue: true });
    await cli.cursorHook({ hook_event_name: "afterAgentResponse", conversation_id: "c1", text: "Dark mode added." });
    const state = path.join(home, ".beacon", "state", "cursor-c1.json");
    expect(JSON.parse(readFileSync(state, "utf8"))).toEqual({ prompts: ["Add a dark mode"], notes: ["Dark mode added."] });
    // No config on this fake computer, so stop sends nothing, but it still clears the turn.
    expect(await cli.cursorHook({ hook_event_name: "stop", conversation_id: "c1", status: "completed", workspace_roots: [home] })).toEqual({});
    expect(existsSync(state)).toBe(false);
  });
});
