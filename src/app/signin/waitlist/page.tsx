import Link from "next/link";
import { BeaconMark } from "@/components/site/Brand";

export const dynamic = "force-dynamic";

export default function WaitlistPage() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "48px 16px", background: "#fafafa", color: "#18181b" }}>
      <div style={{ width: "min(440px, 100%)", border: "1px solid #e6e6ea", borderRadius: 10, padding: "26px", background: "#fff" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
          <BeaconMark size={22} />
          <strong style={{ fontSize: 15 }}>Beacon</strong>
        </div>
        <h1 style={{ fontSize: 22, letterSpacing: "-0.02em", margin: "0 0 8px" }}>You&apos;re on the early access list</h1>
        <p style={{ color: "#5f5f6b", margin: "0 0 18px", lineHeight: 1.5 }}>
          We&apos;ll email you when your workspace is ready. Sample workspaces stay open meanwhile if you want to explore.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Link href="/signin" style={{ color: "#18181b", fontWeight: 600 }}>
            Open a sample workspace
          </Link>
          <Link href="/" style={{ color: "#5f5f6b", fontSize: 14 }}>
            Back to the site
          </Link>
        </div>
      </div>
    </main>
  );
}
