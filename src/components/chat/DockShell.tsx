"use client";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/** Opens and closes the agent panel (Cmd/Ctrl+J). Remembers the choice in a cookie. */
export function DockShell({ initialOpen, children }: { initialOpen: boolean; children: React.ReactNode }) {
  const params = useSearchParams();
  const path = usePathname();
  const [open, setOpen] = useState(initialOpen);
  const asked = params.get("agent");
  useEffect(() => {
    if (asked) setOpen(true);
  }, [asked]);
  useEffect(() => {
    document.cookie = `relay_dock=${open ? "open" : "closed"}; path=/; samesite=lax`;
    document.documentElement.dataset.dock = open ? "open" : "closed";
  }, [open]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (!open) return;
    const list = document.querySelector(".dock .chat-scroll");
    if (list) list.scrollTop = list.scrollHeight;
  });
  // The full chat view already shows the conversation.
  if (path.startsWith("/messages")) return null;
  return (
    <>
      <aside className="dock" data-open={open} aria-label="Agents" id="agents-panel">
        <button type="button" className="dock-close" onClick={() => setOpen(false)} aria-label="Hide the agent panel" title="Hide (⌘J)">×</button>
        {children}
      </aside>
      {!open && (
        <button type="button" className="dock-launch" onClick={() => setOpen(true)} aria-controls="agents-panel">
          <span className="dock-dot" />Ask an agent <kbd>⌘J</kbd>
        </button>
      )}
    </>
  );
}
