// The agent chat's model: a real conversation through the Vercel AI SDK. Beacon's own abilities
// (who owns what, sourced team answers, routing, what changed) are tools the model may call.
// No model configured: chatModel() is null and the chat uses the fixed replies in assistant.ts.
import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";
import { MODEL } from "./llm";

let override: LanguageModel | null | undefined;

/** For tests: a mock model (never a real one), or null to force the fixed replies. */
export function setChatModel(m: LanguageModel | null | undefined) {
  override = m;
}

export function chatModel(): LanguageModel | null {
  if (override !== undefined) return override;
  if (process.env.RELAY_LLM_PROVIDER === "offline") return null;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const authToken = process.env.ANTHROPIC_AUTH_TOKEN;
  if (!apiKey && !authToken) return null;
  // Explicit base URL, so an ANTHROPIC_BASE_URL meant for another tool doesn't redirect the app's calls.
  const base = (process.env.RELAY_ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "");
  const provider = createAnthropic(apiKey ? { apiKey, baseURL: `${base}/v1` } : { authToken, baseURL: `${base}/v1` });
  return provider(MODEL);
}
