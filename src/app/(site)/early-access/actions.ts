"use server";
import { saveLead } from "@/lib/leads";

export interface AccessState {
  status: "idle" | "ok" | "error";
  error?: string;
}

const seen = new Map<string, number>();

export async function requestAccess(_prev: AccessState, form: FormData): Promise<AccessState> {
  // Honeypot: real people never fill this hidden field.
  if (String(form.get("website") ?? "")) return { status: "ok" };
  const email = String(form.get("email") ?? "");
  // Light rate limit per email per server, so a double-click doesn't send twice.
  const last = seen.get(email.toLowerCase());
  if (last && Date.now() - last < 60_000) return { status: "ok" };
  const r = await saveLead({
    email,
    name: String(form.get("name") ?? ""),
    company: String(form.get("company") ?? ""),
    role: String(form.get("role") ?? ""),
    teamSize: String(form.get("teamSize") ?? ""),
    note: String(form.get("note") ?? ""),
    source: String(form.get("source") ?? ""),
  });
  if (!r.ok) return { status: "error", error: r.error };
  seen.set(email.toLowerCase(), Date.now());
  return { status: "ok" };
}
