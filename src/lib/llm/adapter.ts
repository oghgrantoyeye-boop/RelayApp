/**
 * The one LLM interface. Providers (Claude now, others later, or on-premises)
 * implement it; nothing else in the app talks to a model directly.
 */
export interface SummaryInput {
  /** Who the text is for, e.g. "product lead". */
  audience: string;
  /** Only facts the reader can see, already rendered at their level. */
  facts: { label: string; text: string; source_unit: string }[];
}

export interface Llm {
  name: string;
  summarize(input: SummaryInput): Promise<string>;
}
