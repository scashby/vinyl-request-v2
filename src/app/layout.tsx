import "styles/global.css";
import "styles/internal.css";
import "styles/base.css";

import { Inter } from "next/font/google";
import Layout from "components/Layout";

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
      <body className={`${inter.className} antialiased bg-black text-white`}>
        <Layout>{children}</Layout>
      </body>
    </html>
  );
}
