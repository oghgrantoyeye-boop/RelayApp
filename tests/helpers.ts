import { DEFAULT_DEMO } from "@/lib/demos";
import { scoped } from "@/lib/scoped";

/** Scope a pack-local id to the default demo org used by most tests. */
export const sid = (local: string, orgId = DEFAULT_DEMO) => scoped(orgId, local);
