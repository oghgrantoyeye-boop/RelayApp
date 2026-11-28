"use client";

import { useEffect, useState } from "react";

const KEY = "beacon-connect-command";

/**
 * The one-line connect command for coding agents. A new token is only on the server for one page
 * view, so the command is kept in this tab until it's dismissed, and a refresh doesn't hide it.
 */
export function ConnectCommand({ command, prefix, note }: { command: string | null; prefix: string; note: string }) {
  const [shown, setShown] = useState<string | null>(command);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      if (command) {
        sessionStorage.setItem(KEY, JSON.stringify({ prefix, command }));
        setShown(command);
      } else {
        const saved = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
        // Only the command for the token on file: after a rotate or revoke the old one is useless.
        if (saved?.prefix && saved.prefix === prefix) setShown(saved.command);
        else sessionStorage.removeItem(KEY);
      }
    } catch {
      // storage unavailable: show what the server sent
    }
  }, [command, prefix]);

  if (!shown) return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  const dismiss = () => {
    try {
      sessionStorage.removeItem(KEY);
    } catch {}
    setShown(null);
  };
  return (
    <ol style={{ margin: "10px 0 0", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 8 }}>
      <li>
        Run this in a terminal on your computer. It needs Node 18 or later. {note}
        <pre className="code" style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{shown}</pre>
        <div className="row" style={{ gap: 8, marginTop: 6 }}>
          <button type="button" className="b sm bp" onClick={copy}>{copied ? "Copied" : "Copy command"}</button>
          <button type="button" className="b sm" onClick={dismiss}>I've run it, hide this</button>
        </div>
        <span className="small muted" style={{ display: "block", marginTop: 6 }}>
          It saves the token in ~/.beacon/config.json, readable only by you, and adds Beacon to Claude Code, Codex and Cursor if it finds them. Your other hooks stay as they are.
        </span>
      </li>
      <li>Restart any agent that was open, then work as usual. Claude Code reports when a session ends; Codex and Cursor after each reply.</li>
      <li>Today&apos;s draft shows up under Write update. Check the connection with <span className="mono">node ~/.beacon/beacon.mjs status</span>, or remove it with <span className="mono">node ~/.beacon/beacon.mjs disconnect</span>.</li>
    </ol>
  );
}
