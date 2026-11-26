import type { Llm, SummaryInput } from "./adapter";

/** Built-in template text, used when no API key is set so the demo never breaks. */
export const templateLlm: Llm = {
  name: "template",
  async summarize({ facts }: SummaryInput) {
    if (facts.length === 0) return "Nothing to report.";
    return facts
      .slice(0, 4)
      .map((f) => `${f.label}: ${f.text.split("\n")[0]} [${f.source_unit}]`)
      .join(" ");
  },
};
