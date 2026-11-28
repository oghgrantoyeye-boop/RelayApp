// Feature flags. Read at call time, so tests can switch them per file.

/**
 * Agents that do work (research, document review, code, drafting) and the features built around
 * them: the agent gallery, worker teammates, the task workspace, the leadership digest and the team
 * map. The product spec defers these until team context, answers and routing are trusted
 * (docs/product/team-context-answers-routing.md), so they're off unless BEACON_WORKERS is on.
 */
export function workersEnabled(): boolean {
  return ["1", "true", "on", "yes"].includes((process.env.BEACON_WORKERS ?? "").trim().toLowerCase());
}

export const WORKERS_OFF_MESSAGE =
  "Beacon doesn't do work for teams yet. It answers questions from what teams have said and done, and sends the rest to the right person.";
