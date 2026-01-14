import "./globals.css"; // The ONLY global style file
import { Inter, Playfair_Display } from "next/font/google";
import Layout from "components/Layout";
import { Analytics } from "@vercel/analytics/next"

const inter = Inter({ subsets: ["latin"], variable: '--font-inter' });
const playfair = Playfair_Display({ subsets: ["latin"], variable: '--font-playfair' });

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
      <body className={`${inter.variable} ${playfair.variable} font-sans antialiased bg-white text-black`}>
        <Layout>{children}</Layout>
        <Analytics />
      </body>
    </html>
  );
}
