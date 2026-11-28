// The one model adapter. Features ask for structured JSON by task name; if the model is not
// configured, refuses or fails, they get null and use the offline writer in offline.ts instead.
// Swap providers here (Bedrock, Vertex, on-premises) without touching feature code.
import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import { getAiScope } from "./scope";

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

export const MODEL = "claude-opus-5-5";

/** What the running server has done with the model since it started. Shown on the Integrations page. */
export const usage = { calls: 0, failures: 0, inputTokens: 0, outputTokens: 0, lastError: null as string | null, lastErrorAt: null as Date | null };

function fail(message: string) {
  usage.failures++;
  usage.lastError = message;
  usage.lastErrorAt = new Date();
  console.warn(`[beacon] ${message}; using offline writer`);
}

/**
 * The workspace this call is for has reached its monthly AI budget (T-35): the call isn't made and
 * the offline writer answers, with a note saying why.
 */
export async function overBudget(task: string): Promise<boolean> {
  const scope = getAiScope();
  if (!scope?.db || !scope.orgId) return false;
  const { monthSpend, capResetsAt } = await import("./spend");
  const spend = await monthSpend(scope.db, scope.orgId);
  if (!spend.capped) return false;
  fail(`This workspace reached its monthly AI budget of $${spend.cap} on ${task}; the offline writer answers until ${capResetsAt().toISOString().slice(0, 10)}`);
  return true;
}

/** Count a call against the workspace it was for. Never blocks the answer if recording fails. */
export async function record(task: string, inputTokens: number, outputTokens: number) {
  const scope = getAiScope();
  if (!scope?.db) return;
  try {
    const { recordUsage } = await import("./spend");
    await recordUsage(scope.db, { orgId: scope.orgId ?? null, task, inputTokens, outputTokens });
  } catch (err) {
    console.error("[beacon] recording AI usage failed:", err);
  }
}

class ClaudeLLM implements LLM {
  name = "Claude";
  // Explicit base URL, so an ANTHROPIC_BASE_URL meant for another tool doesn't redirect the app's calls.
  private client = new Anthropic({ timeout: 45_000, maxRetries: 1, baseURL: process.env.RELAY_ANTHROPIC_BASE_URL || "https://api.anthropic.com" });

  async research(req: { system: string; prompt: string }, onStep: (s: ResearchStep) => void): Promise<ResearchResult> {
    if (await overBudget("research")) throw new Error("This workspace reached its monthly AI budget. Research runs again next month, or an admin can raise the budget on Integrations.");
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
    await record("research", out.inputTokens, out.outputTokens);
    return out;
  }
  private cache = new Map<string, unknown>();

  async json<T>(task: string, req: JsonRequest): Promise<T | null> {
    const key = createHash("sha256").update(task + req.system + req.prompt).digest("hex");
    if (this.cache.has(key)) return this.cache.get(key) as T;
    if (await overBudget(task)) return null;
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
      usage.calls++;
      const inputTokens = res.usage.input_tokens + (res.usage.cache_read_input_tokens ?? 0) + (res.usage.cache_creation_input_tokens ?? 0);
      usage.inputTokens += inputTokens;
      usage.outputTokens += res.usage.output_tokens;
      await record(task, inputTokens, res.usage.output_tokens);
      if (res.stop_reason === "refusal" || res.stop_reason === "max_tokens") {
        fail(`Claude stopped (${res.stop_reason}) on ${task}`);
        return null;
      }
      const text = res.content.find((b) => b.type === "text");
      if (!text || text.type !== "text") return null;
      const parsed = JSON.parse(text.text) as T;
      if (this.cache.size > 500) this.cache.clear();
      this.cache.set(key, parsed);
      return parsed;
    } catch (err) {
      if (err instanceof Anthropic.AuthenticationError) fail("Claude rejected the API key");
      else if (err instanceof Anthropic.RateLimitError) fail("Claude rate limited the app");
      else if (err instanceof Anthropic.APIError) fail(`Claude error ${err.status} on ${task}`);
      else fail(`Claude call failed on ${task}: ${(err as Error).message}`);
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

export interface AiStatus {
  provider: "claude" | "offline" | "test";
  model: string | null;
  /** Why the offline writer is in use, when it is. */
  reason?: string;
}

/** Which model answers on this server, for the UI. Reads the same settings as getLLM(). */
export function aiStatus(): AiStatus {
  const llm = getLLM();
  if (llm instanceof ClaudeLLM) return { provider: "claude", model: MODEL };
  if (llm instanceof OfflineLLM)
    return {
      provider: "offline",
      model: null,
      reason: process.env.RELAY_LLM_PROVIDER === "offline" ? "RELAY_LLM_PROVIDER is set to offline." : "No ANTHROPIC_API_KEY is set.",
    };
  return { provider: "test", model: llm.name };
}

export function setLLM(llm: LLM | null) {
  current = llm;
}
