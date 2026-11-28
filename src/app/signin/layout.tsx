import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";

export const metadata: Metadata = {
  title: "Sign in · Beacon",
  description: "Choose a workspace or open a sample to explore Beacon.",
};

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body style={{ margin: 0, fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>{children}</body>
    </html>
  );
}
