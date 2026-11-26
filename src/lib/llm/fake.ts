import type { Llm, SummaryInput } from "./adapter";

/** Deterministic LLM for tests. Echoes its inputs so tests can see what it was given. */
export function fakeLlm(): Llm & { calls: SummaryInput[] } {
  const calls: SummaryInput[] = [];
  return {
    name: "fake",
    calls,
    async summarize(input) {
      calls.push(input);
      return `FAKE(${input.audience}): ${input.facts.map((f) => `${f.label}=${f.text}`).join("; ")}`;
    },
  };
}
