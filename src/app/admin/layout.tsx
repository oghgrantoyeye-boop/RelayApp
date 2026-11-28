import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";

export const metadata: Metadata = {
  title: "Admin · Beacon",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body style={{ margin: 0, fontFamily: "var(--font-geist-sans), system-ui, sans-serif", background: "#fafafa", color: "#18181b" }}>
        {children}
      </body>
    </html>
  );
}
