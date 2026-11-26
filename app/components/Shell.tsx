import type { ReactNode } from "react";
import type { Member } from "@/lib/permissions";
import { Sidebar } from "./Sidebar";

export function Shell({ me, current, children }: { me: Member; current: string; children: ReactNode }) {
  return (
    <div className="shell">
      <Sidebar me={me} current={current} />
      <main className="main">{children}</main>
    </div>
  );
}
