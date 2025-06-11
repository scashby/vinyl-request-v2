// AdminSidebar.tsx — Next.js App Router compatible sidebar for admin pages

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminSidebar() {
  const pathname = usePathname();

  const navItems = [
    { label: "Events", path: "/admin/manage-events" },
    { label: "Queue", path: "/admin/edit-queue" },
    { label: "Add Vinyl", path: "/admin/add-customer-vinyl" },
    { label: "Import Collection", path: "/admin/import-discogs" },
    { label: "Now Playing", path: "/admin/now-playing-admin" },
    { label: "Logout", path: "/" },
  ];

  return (
    <div className="w-48 bg-gray-100 h-screen p-4 border-r fixed">
      <h2 className="text-lg font-bold mb-6">Admin</h2>
      <ul className="space-y-3">
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <li key={item.path}>
              <Link
                href={item.path}
                className={
                  isActive
                    ? "text-blue-600 font-semibold"
                    : "text-gray-700 hover:text-blue-600"
                }
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
