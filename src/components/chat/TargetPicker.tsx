"use client";
import { usePathname } from "next/navigation";

/** Pick who the panel talks to: your own agent, or any agent teammate. */
export function TargetPicker({ current, groups, action }: {
  current: string;
  groups: { label: string; agents: { id: string; name: string }[] }[];
  action: (form: FormData) => Promise<void>;
}) {
  const path = usePathname();
  return (
    <form action={action}>
      <input type="hidden" name="path" value={path} />
      <select key={current} name="target" defaultValue={current} aria-label="Talk to" onChange={(e) => e.currentTarget.form?.requestSubmit()} className="dock-select">
        <option value="me">Your Beacon agent (finds the right team)</option>
        {groups.map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </optgroup>
        ))}
      </select>
    </form>
  );
}
