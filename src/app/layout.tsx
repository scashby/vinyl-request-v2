// Root layout for all pages (sets up global styles, font, and metadata)

import "styles/globals.css";
import { Inter } from "next/font/google";
import Layout from "components/Layout";
import "styles/internal.css";


const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Dead Wax Dialogues",
  description: "Drop the needle. Let the side play.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className + " antialiased"}>
        <Layout>{children}</Layout>
      </body>
    </html>
  );
}
