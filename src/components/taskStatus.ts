import type { Tone } from "./ui";

export const TASK_STATUS: Record<string, [Tone, string]> = {
  queued: ["gray", "Queued"],
  running: ["blue", "Working"],
  done: ["green", "Done"],
  failed: ["red", "Failed"],
  stopped: ["gray", "Taken over"],
  needs_key: ["amber", "Needs an API key"],
};
