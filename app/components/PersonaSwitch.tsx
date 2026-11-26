"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { setPersona } from "../actions";

export function PersonaSwitch({ current, groups }: { current: string; groups: { unit: string; members: { id: string; name: string; role: string }[] }[] }) {
  const path = usePathname();
  const qs = useSearchParams().toString();
  return (
    <form action={setPersona} className="persona">
      <input type="hidden" name="back" value={qs ? `${path}?${qs}` : path} />
      <label className="muted small" htmlFor="persona">
        Viewing Relay as
      </label>
      <select id="persona" name="member" defaultValue={current} onChange={(e) => e.currentTarget.form?.requestSubmit()}>
        {groups.map((g) => (
          <optgroup key={g.unit} label={g.unit}>
            {g.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} · {m.role}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <noscript>
        <button className="b">Switch</button>
      </noscript>
    </form>
  );
}
