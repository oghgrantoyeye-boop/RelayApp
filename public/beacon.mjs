#!/usr/bin/env node
// Beacon for local coding agents: Claude Code, Codex and Cursor.
//
// Install (the Integrations page in Beacon shows this with your own URL and token):
//   curl -fsSL https://YOUR-BEACON/beacon.mjs | node --input-type=module - connect --url https://YOUR-BEACON --token rly_...
//
// Commands:
//   connect --url URL --token TOKEN [--only claude,codex,cursor]
//                 Saves your token in ~/.beacon/config.json (only you can read it), copies this
//                 script to ~/.beacon/beacon.mjs, and adds Beacon to each coding agent it finds.
//   status        Checks the token and lists which agents report to Beacon.
//   disconnect    Removes Beacon from every agent's settings and deletes ~/.beacon.
//   hook <tool>   Run by the agents themselves. Sends what you asked for, the agent's closing
//                 notes and your recent commits to Beacon, which adds them to today's draft
//                 update. Nothing reaches your team until you review and publish it.
//
// What is sent: repo, branch, your last few prompts, the agent's closing notes, recent commit
// messages and a one-line diff summary. Never code, diffs or files. Beacon strips anything that
// looks like a secret before storing it. A hook never fails or slows your agent: errors are
// ignored and it gives up after 5 seconds.
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, chmodSync, readdirSync, statSync, copyFileSync } from "node:fs";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";

const HOME = process.env.BEACON_HOME_DIR || os.homedir();
const DIR = path.join(HOME, ".beacon");
const CONFIG = path.join(DIR, "config.json");
const SCRIPT = path.join(DIR, "beacon.mjs");
const STATE = path.join(DIR, "state");
const TIMEOUT_MS = 5000;

const CLAUDE_SETTINGS = path.join(HOME, ".claude", "settings.json");
const CODEX_CONFIG = path.join(HOME, ".codex", "config.toml");
const CURSOR_HOOKS = path.join(HOME, ".cursor", "hooks.json");
const CURSOR_EVENTS = ["beforeSubmitPrompt", "afterAgentResponse", "stop"];

// ---------- small helpers ----------

function readJson(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, value, mode) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(value, null, 2) + "\n", mode ? { mode } : undefined);
  if (mode) chmodSync(file, mode);
}

export function loadConfig() {
  return readJson(CONFIG, null);
}

function hookCommand(tool) {
  return `node "${SCRIPT}" hook ${tool}`;
}

/** A hook command that belongs to Beacon: this script, or the old Relay hook it replaces. */
export function isOurs(command) {
  return typeof command === "string" && (command.includes(".beacon/beacon.mjs") || command.includes(".beacon\\beacon.mjs") || command.includes("relay-hook.mjs"));
}

function onPath(name) {
  const exts = process.platform === "win32" ? ["", ".cmd", ".exe"] : [""];
  for (const dir of (process.env.PATH || "").split(path.delimiter)) {
    for (const ext of exts) if (dir && existsSync(path.join(dir, name + ext))) return true;
  }
  return false;
}

export function detect() {
  return {
    claude: existsSync(path.join(HOME, ".claude")) || onPath("claude"),
    codex: existsSync(path.join(HOME, ".codex")) || onPath("codex"),
    cursor: existsSync(path.join(HOME, ".cursor")) || onPath("cursor"),
  };
}

function git(cwd, args) {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 2000 }).trim();
  } catch {
    return "";
  }
}

export function gitInfo(cwd) {
  const remote = git(cwd, ["remote", "get-url", "origin"]);
  const top = git(cwd, ["rev-parse", "--show-toplevel"]);
  return {
    repo: remote ? remote.replace(/\.git$/, "").split(/[/:]/).slice(-2).join("/") : path.basename(top || cwd),
    branch: git(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]) || "unknown",
    commits: git(cwd, ["log", "--oneline", "-n", "5", "--since=12.hours.ago"]).split("\n").filter(Boolean),
    diffstat: git(cwd, ["diff", "--shortstat", "HEAD"]),
  };
}

function keepPrompt(t) {
  return typeof t === "string" && t.trim() && !t.trim().startsWith("<") && t.length < 2000;
}

// ---------- Claude Code: ~/.claude/settings.json, SessionEnd hook ----------

export function installClaude() {
  const settings = readJson(CLAUDE_SETTINGS, existsSync(CLAUDE_SETTINGS) ? undefined : {});
  if (!settings || typeof settings !== "object") return "skipped: ~/.claude/settings.json isn't valid JSON, so Beacon left it alone";
  settings.hooks ??= {};
  const groups = removeOursFromClaude(settings.hooks.SessionEnd);
  groups.push({ hooks: [{ type: "command", command: hookCommand("claude"), timeout: 10 }] });
  settings.hooks.SessionEnd = groups;
  writeJson(CLAUDE_SETTINGS, settings);
  return "reports when a session ends";
}

function removeOursFromClaude(groups) {
  return (Array.isArray(groups) ? groups : [])
    .map((g) => ({ ...g, hooks: (g.hooks ?? []).filter((h) => !isOurs(h.command)) }))
    .filter((g) => g.hooks.length > 0);
}

export function uninstallClaude() {
  const settings = readJson(CLAUDE_SETTINGS, null);
  if (!settings?.hooks?.SessionEnd) return false;
  const groups = removeOursFromClaude(settings.hooks.SessionEnd);
  if (groups.length) settings.hooks.SessionEnd = groups;
  else delete settings.hooks.SessionEnd;
  writeJson(CLAUDE_SETTINGS, settings);
  return true;
}

// ---------- Codex: ~/.codex/config.toml, top-level notify ----------

/** The top-level `notify = [...]` line, if any (keys after the first [table] belong to that table). */
function findNotify(lines) {
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.startsWith("[")) return -1;
    if (/^notify\s*=/.test(t)) return i;
  }
  return -1;
}

export function installCodex(config) {
  const text = existsSync(CODEX_CONFIG) ? readFileSync(CODEX_CONFIG, "utf8") : "";
  const lines = text.split("\n");
  const ours = `notify = ${JSON.stringify(["node", SCRIPT, "hook", "codex"])}`;
  const at = findNotify(lines);
  if (at >= 0) {
    const current = lines[at];
    if (!isOurs(current)) {
      // Codex runs one notify command. Keep the old one and run it after Beacon's.
      let previous;
      try {
        previous = JSON.parse(current.replace(/^\s*notify\s*=\s*/, "").replace(/'/g, '"'));
      } catch {
        return "skipped: Codex already has a notify command Beacon couldn't read, so Beacon left it alone";
      }
      if (!Array.isArray(previous)) return "skipped: Codex's notify setting isn't a list, so Beacon left it alone";
      config.codexPreviousNotify = previous;
    }
    lines[at] = ours;
  } else {
    lines.unshift(ours);
  }
  mkdirSync(path.dirname(CODEX_CONFIG), { recursive: true });
  writeFileSync(CODEX_CONFIG, lines.join("\n"));
  return config.codexPreviousNotify ? "reports after each turn (and still runs your earlier notify command)" : "reports after each turn";
}

export function uninstallCodex(config) {
  if (!existsSync(CODEX_CONFIG)) return false;
  const lines = readFileSync(CODEX_CONFIG, "utf8").split("\n");
  const at = findNotify(lines);
  if (at < 0 || !isOurs(lines[at])) return false;
  const previous = config?.codexPreviousNotify;
  if (Array.isArray(previous)) lines[at] = `notify = ${JSON.stringify(previous)}`;
  else lines.splice(at, 1);
  writeFileSync(CODEX_CONFIG, lines.join("\n"));
  return true;
}

// ---------- Cursor: ~/.cursor/hooks.json ----------

export function installCursor() {
  const file = readJson(CURSOR_HOOKS, existsSync(CURSOR_HOOKS) ? undefined : { version: 1, hooks: {} });
  if (!file || typeof file !== "object") return "skipped: ~/.cursor/hooks.json isn't valid JSON, so Beacon left it alone";
  file.version ??= 1;
  file.hooks ??= {};
  for (const event of CURSOR_EVENTS) {
    const list = (Array.isArray(file.hooks[event]) ? file.hooks[event] : []).filter((h) => !isOurs(h.command));
    list.push({ command: hookCommand("cursor"), timeout: 10 });
    file.hooks[event] = list;
  }
  writeJson(CURSOR_HOOKS, file);
  return "reports when the agent stops (restart Cursor to load it)";
}

export function uninstallCursor() {
  const file = readJson(CURSOR_HOOKS, null);
  if (!file?.hooks) return false;
  for (const event of CURSOR_EVENTS) {
    if (!Array.isArray(file.hooks[event])) continue;
    const list = file.hooks[event].filter((h) => !isOurs(h.command));
    if (list.length) file.hooks[event] = list;
    else delete file.hooks[event];
  }
  writeJson(CURSOR_HOOKS, file);
  return true;
}

// ---------- sending ----------

async function send(report, config = loadConfig()) {
  if (!config?.url || !config?.token) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${config.url.replace(/\/$/, "")}/api/sources/coding-session`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${config.token}` },
      body: JSON.stringify(report),
      signal: ctrl.signal,
    });
    return res.ok ? await res.json() : null;
  } catch {
    return null; // Beacon is unreachable: skip quietly.
  } finally {
    clearTimeout(timer);
  }
}

function readStdin() {
  try {
    return JSON.parse(readFileSync(0, "utf8") || "{}");
  } catch {
    return {};
  }
}

function textOf(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.filter((b) => b?.type === "text").map((b) => b.text).join("\n");
  return "";
}

/** Claude Code transcript (JSON lines): your prompts and the agent's last few messages. */
export function readClaudeTranscript(file) {
  const prompts = [];
  const notes = [];
  let lines = [];
  try {
    lines = file ? readFileSync(file, "utf8").split("\n") : [];
  } catch {
    return { prompts, notes };
  }
  for (const line of lines) {
    let o;
    try {
      o = JSON.parse(line);
    } catch {
      continue;
    }
    if (o.isSidechain) continue;
    if (o.type === "user" && typeof o.message?.content === "string") {
      if (keepPrompt(o.message.content)) prompts.push(o.message.content.trim());
    } else if (o.type === "assistant") {
      const t = textOf(o.message?.content).trim();
      if (t) notes.push(t);
    }
  }
  return { prompts: prompts.slice(-6), notes: notes.slice(-3).map((n) => n.slice(0, 800)) };
}

/** Builds the report for one hook call, or null when there's nothing to send. Exported for tests. */
export function buildReport(tool, input, cwd) {
  if (tool === "claude") {
    const { prompts, notes } = readClaudeTranscript(input.transcript_path);
    if (!prompts.length && !notes.length) return null;
    return { tool: "claude_code", session_id: input.session_id, ...gitInfo(input.cwd || cwd), prompts, notes };
  }
  if (tool === "codex") {
    if (input.type !== "agent-turn-complete") return null;
    const prompts = (input["input-messages"] ?? []).filter(keepPrompt).slice(-6);
    const last = input["last-assistant-message"];
    const notes = typeof last === "string" && last.trim() ? [last.trim().slice(0, 800)] : [];
    if (!prompts.length && !notes.length) return null;
    return { tool: "codex", session_id: input["thread-id"] ?? input["session-id"], ...gitInfo(input.cwd || cwd), prompts, notes };
  }
  return null;
}

// Cursor reports in pieces: the prompt before the turn, the reply after it, then "stop". Beacon
// keeps the pieces in ~/.beacon/state until the turn stops, then sends them together.
function cursorStateFile(conversationId) {
  return path.join(STATE, `cursor-${String(conversationId || "default").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 80)}.json`);
}

export async function cursorHook(input) {
  const event = input.hook_event_name;
  const file = cursorStateFile(input.conversation_id);
  const state = readJson(file, { prompts: [], notes: [] });
  if (event === "beforeSubmitPrompt") {
    if (keepPrompt(input.prompt)) state.prompts = [...state.prompts, input.prompt.trim()].slice(-6);
    writeJson(file, state);
    return { continue: true };
  }
  if (event === "afterAgentResponse") {
    if (typeof input.text === "string" && input.text.trim()) state.notes = [...state.notes, input.text.trim().slice(0, 800)].slice(-3);
    writeJson(file, state);
    return {};
  }
  if (event === "stop") {
    rmSync(file, { force: true });
    cleanOldState();
    if (!state.prompts.length && !state.notes.length) return {};
    const cwd = (Array.isArray(input.workspace_roots) && input.workspace_roots[0]) || process.cwd();
    await send({ tool: "cursor", session_id: input.conversation_id, ...gitInfo(cwd), prompts: state.prompts, notes: state.notes });
    return {};
  }
  return {};
}

function cleanOldState() {
  try {
    const cutoff = Date.now() - 2 * 24 * 3600 * 1000;
    for (const f of readdirSync(STATE)) {
      const p = path.join(STATE, f);
      if (statSync(p).mtimeMs < cutoff) rmSync(p, { force: true });
    }
  } catch {
    // nothing to clean
  }
}

async function hook(tool, extra) {
  if (tool === "cursor") {
    // Cursor waits for an answer on stdout, so answer even if something fails.
    let out = {};
    try {
      out = await cursorHook(readStdin());
    } catch {
      out = { continue: true };
    }
    process.stdout.write(JSON.stringify(out) + "\n");
    return;
  }
  if (tool === "codex") {
    let input = {};
    try {
      input = JSON.parse(extra || "{}");
    } catch {
      input = {};
    }
    const config = loadConfig();
    const previous = config?.codexPreviousNotify;
    if (Array.isArray(previous) && previous.length) {
      try {
        spawn(previous[0], [...previous.slice(1), extra ?? ""], { detached: true, stdio: "ignore" }).unref();
      } catch {
        // the old command is gone
      }
    }
    const report = buildReport("codex", input, process.cwd());
    if (report) await send(report, config);
    return;
  }
  if (tool === "claude") {
    const report = buildReport("claude", readStdin(), process.cwd());
    if (!report) return;
    const r = await send(report);
    if (r?.review) process.stderr.write(`Beacon added this session to today's draft. Review it: ${r.review}\n`);
  }
}

// ---------- connect, status, disconnect ----------

function arg(args, name) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

async function installSelf(url) {
  mkdirSync(DIR, { recursive: true });
  let me = "";
  try {
    me = fileURLToPath(import.meta.url);
  } catch {
    me = "";
  }
  if (me && existsSync(me) && path.resolve(me) !== path.resolve(SCRIPT)) {
    copyFileSync(me, SCRIPT);
    return true;
  }
  if (existsSync(SCRIPT) && path.resolve(me || "") === path.resolve(SCRIPT)) return true;
  // Run from a pipe: fetch a copy to keep.
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/beacon.mjs`);
    if (!res.ok) return false;
    writeFileSync(SCRIPT, await res.text());
    return true;
  } catch {
    return false;
  }
}

async function check(config) {
  try {
    const res = await fetch(`${config.url.replace(/\/$/, "")}/api/sources/coding-session`, {
      headers: { authorization: `Bearer ${config.token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status === 401) return { error: "Beacon doesn't recognise this token. Issue a new one on the Integrations page." };
    if (!res.ok) return { error: `Beacon answered ${res.status}.` };
    return await res.json();
  } catch (e) {
    return { error: `Couldn't reach ${config.url} (${e?.message ?? e}).` };
  }
}

const LABEL = { claude: "Claude Code", codex: "Codex", cursor: "Cursor" };

async function connect(args) {
  const url = arg(args, "url");
  const token = arg(args, "token");
  if (!url || !token) {
    console.error("Usage: beacon connect --url https://your-beacon --token rly_... [--only claude,codex,cursor]");
    process.exitCode = 1;
    return;
  }
  const config = { ...(loadConfig() ?? {}), url: url.replace(/\/$/, ""), token };
  const who = await check(config);
  if (who.error) {
    console.error(who.error);
    process.exitCode = 1;
    return;
  }
  if (!(await installSelf(config.url))) {
    console.error(`Couldn't save Beacon's script to ${SCRIPT}.`);
    process.exitCode = 1;
    return;
  }
  const only = arg(args, "only")?.split(",").map((s) => s.trim());
  const found = detect();
  console.log(`Connected to Beacon as ${who.name} (${who.team}).`);
  for (const tool of ["claude", "codex", "cursor"]) {
    if (only && !only.includes(tool)) continue;
    if (!found[tool] && !only) {
      console.log(`  ${LABEL[tool]}: not found on this computer`);
      continue;
    }
    const result = tool === "claude" ? installClaude() : tool === "codex" ? installCodex(config) : installCursor();
    console.log(`  ${LABEL[tool]}: ${result}`);
  }
  writeJson(CONFIG, config, 0o600);
  console.log(`\nYour token is saved in ${CONFIG}, readable only by you.`);
  console.log(`Work with any of these agents, and today's draft appears at ${config.url}/write. Nothing is shared until you publish it.`);
  console.log(`Check it anytime: node ${SCRIPT} status   Remove it: node ${SCRIPT} disconnect`);
}

async function status() {
  const config = loadConfig();
  if (!config) {
    console.log("Beacon isn't connected on this computer. Run the command from Beacon's Integrations page.");
    return;
  }
  const who = await check(config);
  console.log(who.error ? `Beacon at ${config.url}: ${who.error}` : `Connected to ${config.url} as ${who.name} (${who.team}).`);
  const claude = JSON.stringify(readJson(CLAUDE_SETTINGS, {})?.hooks?.SessionEnd ?? []).includes("beacon.mjs");
  const codex = existsSync(CODEX_CONFIG) && readFileSync(CODEX_CONFIG, "utf8").includes("beacon.mjs");
  const cursor = JSON.stringify(readJson(CURSOR_HOOKS, {})?.hooks ?? {}).includes("beacon.mjs");
  console.log(`  Claude Code: ${claude ? "reporting" : "not set up"}`);
  console.log(`  Codex: ${codex ? "reporting" : "not set up"}`);
  console.log(`  Cursor: ${cursor ? "reporting" : "not set up"}`);
}

function disconnect() {
  const config = loadConfig();
  const removed = [uninstallClaude() && "Claude Code", uninstallCodex(config) && "Codex", uninstallCursor() && "Cursor"].filter(Boolean);
  rmSync(DIR, { recursive: true, force: true });
  console.log(`Beacon is disconnected${removed.length ? ` from ${removed.join(", ")}` : ""}, and ${DIR} is deleted.`);
  console.log("Revoke the token on Beacon's Integrations page too if you won't reconnect.");
}

export async function main(argv) {
  const [cmd, ...args] = argv;
  if (cmd === "hook") return hook(args[0], args[1]);
  if (cmd === "connect") return connect(args);
  if (cmd === "status") return status();
  if (cmd === "disconnect") return disconnect();
  console.log("Usage: beacon connect --url URL --token TOKEN | status | disconnect");
}

if (process.env.BEACON_NO_MAIN !== "1") {
  const argv = process.argv.slice(2);
  const isHook = argv[0] === "hook";
  main(argv)
    .catch((e) => {
      if (!isHook) {
        console.error(e?.message ?? e);
        process.exitCode = 1;
      }
    })
    .finally(() => {
      if (isHook) process.exit(0);
    });
}
