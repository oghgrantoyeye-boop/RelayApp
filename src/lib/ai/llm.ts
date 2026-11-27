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

export interface ResearchStep {
  kind: "search" | "read" | "note";
  text: string;
  url?: string;
}

export interface ResearchResult {
  text: string;
  sources: { title: string; url?: string }[];
  inputTokens: number;
  outputTokens: number;
  searches: number;
}

export interface LLM {
  name: string;
  json<T>(task: string, req: JsonRequest): Promise<T | null>;
  /** Multi-step research with web search. Absent when no model is configured. */
  research?(req: { system: string; prompt: string }, onStep: (s: ResearchStep) => void): Promise<ResearchResult>;
}

// Claude Opus 5.5 list prices per million tokens (input, output). Web search is billed separately.
export const PRICE_PER_MTOK = { input: 4, output: 20 };

const MODEL = "claude-opus-5-5";

class ClaudeLLM implements LLM {
  name = "Claude";
  // Explicit base URL, so an ANTHROPIC_BASE_URL meant for another tool doesn't redirect the app's calls.
  private client = new Anthropic({ timeout: 45_000, maxRetries: 1, baseURL: process.env.RELAY_ANTHROPIC_BASE_URL || "https://api.anthropic.com" });

  async research(req: { system: string; prompt: string }, onStep: (s: ResearchStep) => void): Promise<ResearchResult> {
    const client = new Anthropic({ timeout: 600_000, maxRetries: 1, baseURL: process.env.RELAY_ANTHROPIC_BASE_URL || "https://api.anthropic.com" });
    let messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: req.prompt }];
    const out: ResearchResult = { text: "", sources: [], inputTokens: 0, outputTokens: 0, searches: 0 };
    const seen = new Set<string>();
    // A long server-side tool loop can pause; send the turn back and the server continues it.
    for (let round = 0; round < 5; round++) {
      const stream = client.beta.messages.stream({
        model: MODEL,
        max_tokens: 32000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "medium" },
        system: req.system,
        messages,
        tools: [
          { type: "web_search_20260209", name: "web_search", max_uses: 8 },
          { type: "web_fetch_20260209", name: "web_fetch", max_uses: 6 },
        ],
      });
      stream.on("contentBlock", (b) => {
        if (b.type === "server_tool_use" && b.name === "web_search") {
          out.searches++;
          onStep({ kind: "search", text: `Searched the web: ${String((b.input as { query?: string }).query ?? "")}` });
        } else if (b.type === "server_tool_use" && b.name === "web_fetch") {
          const url = String((b.input as { url?: string }).url ?? "");
          onStep({ kind: "read", text: `Read ${url}`, url });
        } else if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
          for (const r of b.content) {
            if (!seen.has(r.url)) {
              seen.add(r.url);
              out.sources.push({ title: r.title, url: r.url });
            }
          }
        }
      });
      const msg = await stream.finalMessage();
      out.inputTokens += msg.usage.input_tokens + (msg.usage.cache_read_input_tokens ?? 0) + (msg.usage.cache_creation_input_tokens ?? 0);
      out.outputTokens += msg.usage.output_tokens;
      if (msg.stop_reason === "refusal") throw new Error("The model declined this research request.");
      const text = msg.content.filter((b) => b.type === "text").map((b) => (b.type === "text" ? b.text : "")).join("");
      if (text) out.text += text;
      if (msg.stop_reason === "pause_turn") {
        messages = [...messages, { role: "assistant", content: msg.content }];
        continue;
      }
      break;
    }
    // Keep only sources the answer could have cited: everything the searches returned, capped.
    out.sources = out.sources.slice(0, 12);
    return out;
  }
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
  research?: LLM["research"];
  constructor(
    private responses: Record<string, unknown | ((req: JsonRequest) => unknown)> = {},
    research?: ResearchResult,
  ) {
    if (research)
      this.research = async (req, onStep) => {
        this.calls.push({ task: "research", req: { ...req, schema: {} } });
        onStep({ kind: "search", text: "Searched the web: fixed test query" });
        return research;
      };
  }
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
