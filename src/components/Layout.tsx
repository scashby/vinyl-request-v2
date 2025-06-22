"use client";

import NavigationMenu from "./NavigationMenu";
import Footer from "../components/Footer";
import { usePathname } from "next/navigation";

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");

  return (
    <div className="bg-black text-white min-h-screen flex flex-col">
      {!isAdmin && <NavigationMenu />}
      <main className="flex-grow">{children}</main>
      {!isAdmin && <Footer />}
    </div>
  );
}
