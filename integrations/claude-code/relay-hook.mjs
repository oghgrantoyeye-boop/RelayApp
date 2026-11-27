#!/usr/bin/env node
// Relay hook for Claude Code. When a session ends, it sends Relay what you asked for, the agent's
// closing notes and your recent commits. Relay turns that into a DRAFT update that only you can
// see. Nothing reaches your team until you review and publish it.
//
// Setup (see /connect in Relay for your token):
//   1. Save this file somewhere, e.g. ~/.claude/hooks/relay-hook.mjs
//   2. Add to ~/.claude/settings.json:
//      { "hooks": { "SessionEnd": [ { "hooks": [ { "type": "command",
//        "command": "RELAY_URL=https://relay.example.com RELAY_TOKEN=rly_... node ~/.claude/hooks/relay-hook.mjs" } ] } ] } }
//
// It never fails or slows your session: any error is ignored, and it gives up after 5 seconds.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const RELAY_URL = process.env.RELAY_URL || "http://localhost:3000";
const TOKEN = process.env.RELAY_TOKEN;

function readStdin() {
  try {
    return JSON.parse(readFileSync(0, "utf8") || "{}");
  } catch {
    return {};
  }
}

function git(cwd, args) {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 2000 }).trim();
  } catch {
    return "";
  }
}

function textOf(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.filter((b) => b?.type === "text").map((b) => b.text).join("\n");
  return "";
}

/** User prompts and the assistant's last few messages from the session transcript (JSON lines). */
function readTranscript(file) {
  const prompts = [];
  const notes = [];
  if (!file) return { prompts, notes };
  let lines = [];
  try {
    lines = readFileSync(file, "utf8").split("\n");
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
      const t = o.message.content.trim();
      if (t && !t.startsWith("<") && t.length < 2000) prompts.push(t);
    } else if (o.type === "assistant") {
      const t = textOf(o.message?.content).trim();
      if (t) notes.push(t);
    }
  }
  return { prompts: prompts.slice(-6), notes: notes.slice(-3).map((n) => n.slice(0, 800)) };
}

async function main() {
  if (!TOKEN) return;
  const input = readStdin();
  const cwd = input.cwd || process.cwd();
  const { prompts, notes } = readTranscript(input.transcript_path);
  if (prompts.length === 0 && notes.length === 0) return;
  const remote = git(cwd, ["remote", "get-url", "origin"]);
  const repo = remote ? remote.replace(/\.git$/, "").split(/[/:]/).slice(-2).join("/") : path.basename(cwd);
  const body = {
    repo,
    branch: git(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]) || "unknown",
    prompts,
    notes,
    commits: git(cwd, ["log", "--oneline", "-n", "5", "--since=12.hours.ago"]).split("\n").filter(Boolean),
    diffstat: git(cwd, ["diff", "--shortstat", "HEAD"]),
  };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(`${RELAY_URL.replace(/\/$/, "")}/api/sources/coding-session`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (res.ok) {
      const j = await res.json();
      process.stderr.write(`Relay drafted an update from this session. Review it: ${j.review}\n`);
    }
  } catch {
    // Relay is unreachable: skip quietly.
  } finally {
    clearTimeout(timer);
  }
}

main().catch(() => {}).finally(() => process.exit(0));
