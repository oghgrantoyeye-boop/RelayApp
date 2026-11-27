import type { Metadata } from "next";
import { AccessForm } from "./AccessForm";

export const metadata: Metadata = {
  title: "Request early access · Beacon",
  description: "Join Beacon's early access program.",
};

export default async function EarlyAccess({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : sp[k]) ?? "";
  const source = ["utm_source", "utm_medium", "utm_campaign", "ref"].map((k) => (one(k) ? `${k}=${one(k)}` : "")).filter(Boolean).join("&") || "site";
  return (
    <section className="ea">
      <div className="wrap ea-grid">
        <div>
          <span className="eyebrow">Early access</span>
          <h1 className="h2" style={{ marginTop: 16 }}>Give your organization a shared signal.</h1>
          <p className="lede" style={{ marginTop: 18 }}>
            We&apos;re opening Beacon to a small number of early teams first. If work between your teams depends on status meetings, follow-ups
            and someone noticing, we&apos;d like to hear from you.
          </p>
          <ul className="muted" style={{ marginTop: 24, paddingLeft: 18, display: "grid", gap: 8 }}>
            <li>A walkthrough of the working prototype</li>
            <li>A conversation about where coordination breaks down for you</li>
            <li>Early access as Beacon opens up</li>
          </ul>
        </div>
        <AccessForm source={source} />
      </div>
    </section>
  );
}
