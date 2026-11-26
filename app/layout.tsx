import "./globals.css";

export const metadata = { title: "Relay", description: "Cross-team routing for Larkspur Outdoor Co." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
