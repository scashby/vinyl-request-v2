import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "game-deck",
  description: "Standalone game platform — Phase 0 scaffold",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
