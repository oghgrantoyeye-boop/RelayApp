"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const path = usePathname();
  const active = path === href || (href !== "/" && path.startsWith(href + "/"));
  return (
    <Link href={href} className="link" aria-current={active ? "page" : undefined}>
      {children}
    </Link>
  );
}

/** Pick who you are for the demo. The server then enforces every permission as that person. */
export function PersonaSwitcher({
  current,
  groups,
  action,
}: {
  current: string;
  groups: { team: string; people: { id: string; name: string; title: string }[] }[];
  action: (form: FormData) => Promise<void>;
}) {
  const path = usePathname();
  return (
    <form action={action}>
      <input type="hidden" name="path" value={path} />
      <label className="field">
        <span>Viewing as</span>
        <select name="userId" defaultValue={current} onChange={(e) => e.currentTarget.form?.requestSubmit()} aria-label="Viewing as">
          {groups.map((g) => (
            <optgroup key={g.team} label={g.team}>
              {g.people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}, {p.title}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <noscript>
        <button className="b sm" type="submit">Switch</button>
      </noscript>
    </form>
  );
}

export function PathInput() {
  const path = usePathname();
  return <input type="hidden" name="path" value={path} />;
}
