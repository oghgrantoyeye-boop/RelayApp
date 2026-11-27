import type { ReactNode } from "react";

/** A small, safe Markdown subset for agent output: headings, bullets, bold, inline code and http(s) links. No raw HTML. */
export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r/g, "").split("\n");
  let list: string[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push(<p key={blocks.length} style={{ margin: "0 0 10px" }}>{inline(para.join(" "))}</p>);
    if (list.length) blocks.push(<ul key={blocks.length} style={{ margin: "0 0 10px", paddingLeft: 18 }}>{list.map((l, i) => <li key={i} style={{ marginBottom: 4 }}>{inline(l)}</li>)}</ul>);
    para = [];
    list = [];
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    const li = line.match(/^\s*(?:[-*]|\d+\.)\s+(.*)$/);
    if (!line.trim()) flush();
    else if (h) {
      flush();
      blocks.push(<h3 key={blocks.length} style={{ margin: "14px 0 6px", fontSize: 14 }}>{inline(h[2])}</h3>);
    } else if (li) {
      if (para.length) flush();
      list.push(li[1]);
    } else {
      if (list.length) flush();
      para.push(line.trim());
    }
  }
  flush();
  return <div>{blocks}</div>;
}

function inline(s: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    if (m[1]) out.push(<a key={out.length} href={m[2]} target="_blank" rel="noopener noreferrer" style={{ color: "var(--blue)" }}>{m[1]}</a>);
    else if (m[3]) out.push(<strong key={out.length}>{m[3]}</strong>);
    else if (m[4]) out.push(<code key={out.length} className="mono">{m[4]}</code>);
    last = re.lastIndex;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}
