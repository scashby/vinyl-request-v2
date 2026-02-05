"use client";

import NavigationMenu from "./NavigationMenu";
import Footer from "../components/Footer";
import { usePathname } from "next/navigation";

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");
  const isLanding = pathname === "/";

  return (
    <div className="bg-white text-black min-h-screen flex flex-col">
      {!isAdmin && !isLanding && <NavigationMenu />}
      <main className="flex-grow">{children}</main>
      {!isAdmin && <Footer />}
    </div>
  );
}
// AUDIT: inspected, no changes.
