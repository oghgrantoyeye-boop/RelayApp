// The one model adapter. Features ask for structured JSON by task name; if the model is not
// configured, refuses or fails, they get null and use the offline writer in offline.ts instead.
// Swap providers here (Bedrock, Vertex, on-premises) without touching feature code.
import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";

export interface JsonRequest {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
}

export interface LLM {
  name: string;
  json<T>(task: string, req: JsonRequest): Promise<T | null>;
}

const MODEL = "claude-opus-5-5";

class ClaudeLLM implements LLM {
  name = "Claude";
  private client = new Anthropic({ timeout: 45_000, maxRetries: 1 });
  private cache = new Map<string, unknown>();

  async json<T>(task: string, req: JsonRequest): Promise<T | null> {
    const key = createHash("sha256").update(task + req.system + req.prompt).digest("hex");
    if (this.cache.has(key)) return this.cache.get(key) as T;
    try {
      const res = await this.client.beta.messages.create({
        model: MODEL,
        max_tokens: req.maxTokens ?? 4000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low", format: { type: "json_schema", schema: req.schema } },
        system: req.system,
        messages: [{ role: "user", content: req.prompt }],
      });
      if (res.stop_reason === "refusal" || res.stop_reason === "max_tokens") return null;
      const text = res.content.find((b) => b.type === "text");
      if (!text || text.type !== "text") return null;
      const parsed = JSON.parse(text.text) as T;
      if (this.cache.size > 500) this.cache.clear();
      this.cache.set(key, parsed);
      return parsed;
    } catch (err) {
      if (err instanceof Anthropic.AuthenticationError) console.warn("[relay] Claude key rejected; using offline writer");
      else if (err instanceof Anthropic.RateLimitError) console.warn("[relay] Claude rate limited; using offline writer");
      else if (err instanceof Anthropic.APIError) console.warn(`[relay] Claude error ${err.status}; using offline writer`);
      else console.warn("[relay] Claude call failed; using offline writer", (err as Error).message);
      return null;
    }
  }
}

/** No model: every task uses the offline writer. */
class OfflineLLM implements LLM {
  name = "Offline writer";
  async json<T>(): Promise<T | null> {
    return null;
  }
}

/** For tests: fixed answers per task, so tests never call a real model. */
export class FakeLLM implements LLM {
  name = "Fake model";
  calls: { task: string; req: JsonRequest }[] = [];
  constructor(private responses: Record<string, unknown | ((req: JsonRequest) => unknown)> = {}) {}
  async json<T>(task: string, req: JsonRequest): Promise<T | null> {
    this.calls.push({ task, req });
    const r = this.responses[task];
    if (r === undefined) return null;
    return (typeof r === "function" ? (r as (q: JsonRequest) => unknown)(req) : r) as T;
  }
}

let current: LLM | null = null;

export function getLLM(): LLM {
  if (!current) {
    const pref = process.env.RELAY_LLM_PROVIDER;
    const hasKey = !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
    current = pref === "offline" || (!hasKey && pref !== "claude") ? new OfflineLLM() : new ClaudeLLM();
  }
  return current;
}

export function setLLM(llm: LLM | null) {
  current = llm;
}
