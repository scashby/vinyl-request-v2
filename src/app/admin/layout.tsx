// src/app/layout.tsx
// Minimal RootLayout with NO global import of "styles/media-grading.css"
// and no extra body class injection. Keep your site-wide global.css if you have one.
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dead Wax Dialogues",
  description: "Admin",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
