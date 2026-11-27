import type { Metadata } from "next";
import Link from "next/link";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { GeistSerif } from "geist/font/serif";
import "./site.css";
import { Logo } from "@/components/site/Brand";
import { NavShell } from "@/components/site/Interactive";
import { siteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Beacon: a signal across every team",
  description:
    "Beacon is the platform where people and AI agents work side by side. Every team gets an agent that answers for it, does the legwork and routes the rest to the right person, while people make the decisions.",
  openGraph: {
    title: "Beacon: a signal across every team",
    description: "The platform where people and AI agents work side by side.",
    images: ["/og.png"],
    type: "website",
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
  icons: { icon: "/icon.svg" },
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} ${GeistSerif.variable}`}>
      <body>
        <a href="#main" className="sr-only">Skip to content</a>
        <NavShell>
          <div className="wrap nav-inner">
            <Logo />
            <nav className="nav-links" aria-label="Primary">
              <a href="/#product">Product</a>
              <a href="/#agents">Agents</a>
              <a href="/#integrations">Integrations</a>
              <a href="/#how-it-works">How it works</a>
              <a href="/#use-cases">Use cases</a>
              <a href="/#about">About</a>
            </nav>
            <div className="nav-cta">
              <Link className="nav-demo" href="/feed">Try the demo</Link>
              <Link className="btn btn-primary btn-sm" href="/early-access">Request early access</Link>
            </div>
          </div>
        </NavShell>
        <main id="main">{children}</main>
        <footer className="footer">
          <div className="wrap footer-inner">
            <Logo />
            <span className="muted" style={{ fontSize: 14 }}>A signal across every team.</span>
            <nav aria-label="Footer">
              <a href="/#product">Product</a>
              <a href="/#agents">Agents</a>
              <a href="/#integrations">Integrations</a>
              <a href="/#use-cases">Use cases</a>
              <a href="/#how-it-works">How it works</a>
              <a href="/#about">About</a>
              <Link href="/feed">Interactive demo</Link>
              <Link href="/early-access">Early access</Link>
            </nav>
            <p className="small">
              © 2026 Beacon. Product views on this site use illustrative data about a fictional company. Company and product names and logos
              belong to their owners and are used only to identify them; Beacon isn&apos;t affiliated with or endorsed by them.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
