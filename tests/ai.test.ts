// Which model answers is decided by environment variables only: ANTHROPIC_API_KEY turns Claude on,
// RELAY_LLM_PROVIDER=offline forces the offline writer. No network calls are made here.
import { afterEach, describe, expect, it } from "vitest";
import { aiStatus, FakeLLM, MODEL, setLLM } from "@/lib/ai/llm";

const saved = { key: process.env.ANTHROPIC_API_KEY, token: process.env.ANTHROPIC_AUTH_TOKEN, pref: process.env.RELAY_LLM_PROVIDER };

afterEach(() => {
  for (const [k, v] of [["ANTHROPIC_API_KEY", saved.key], ["ANTHROPIC_AUTH_TOKEN", saved.token], ["RELAY_LLM_PROVIDER", saved.pref]] as const) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  setLLM(null);
});

describe("AI provider", () => {
  it("uses the offline writer without a key, and says why", () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_AUTH_TOKEN;
    delete process.env.RELAY_LLM_PROVIDER;
    setLLM(null);
    expect(aiStatus()).toMatchObject({ provider: "offline", model: null, reason: "No ANTHROPIC_API_KEY is set." });
  });

  it("uses Claude when ANTHROPIC_API_KEY is set", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    delete process.env.RELAY_LLM_PROVIDER;
    setLLM(null);
    expect(aiStatus()).toEqual({ provider: "claude", model: MODEL });
  });

  it("can be forced offline even with a key", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    process.env.RELAY_LLM_PROVIDER = "offline";
    setLLM(null);
    expect(aiStatus().provider).toBe("offline");
  });

  it("reports a test model as such", () => {
    setLLM(new FakeLLM({}));
    expect(aiStatus()).toEqual({ provider: "test", model: "Fake model" });
  });
});
