import type { Llm } from "./adapter";
import { templateLlm } from "./template";

export type { Llm, SummaryInput } from "./adapter";

/** Picks the provider. The Claude adapter lands with the summaries step; until then, templates. */
export function getLlm(): Llm {
  return templateLlm;
}
