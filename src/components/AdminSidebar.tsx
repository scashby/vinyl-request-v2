"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <div className="w-48 bg-gray-100 h-screen p-4 border-r fixed overflow-y-auto">
      <h2 className="text-lg font-bold mb-6 text-gray-800">Admin Panel</h2>

      {/* Vinyl & Catalog */}
      <div className="mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
        <h4 className="text-sm font-semibold text-indigo-800 mb-2">💿 Vinyl & Catalog</h4>
        <div className="space-y-2">
          <Link
            href="/admin/add-album"
            className={`block w-full text-center py-1.5 px-2 rounded text-xs font-medium transition-colors ${
              pathname === "/admin/add-album"
                ? "bg-indigo-700 text-white"
                : "bg-indigo-600 text-white hover:bg-indigo-700"
            }`}
          >
            ➕ Add Album
          </Link>
          <Link
            href="/admin/media-grading"
            className={`block w-full text-center py-1.5 px-2 rounded text-xs font-medium transition-colors ${
              pathname === "/admin/media-grading"
                ? "bg-indigo-700 text-white"
                : "bg-indigo-600 text-white hover:bg-indigo-700"
            }`}
          >
            🎯 Media Grading
          </Link>
          {/* Added Organize link */}
          <Link
            href="/admin/organize"
            className={`block w-full text-center py-1.5 px-2 rounded text-xs font-medium transition-colors ${
              pathname === "/admin/organize"
                ? "bg-indigo-700 text-white"
                : "bg-indigo-600 text-white hover:bg-indigo-700"
            }`}
          >
            🗂️ Organize
          </Link>
          <Link
            href="/admin/add-customer-vinyl"
            className={`block w-full text-center py-1.5 px-2 rounded text-xs font-medium transition-colors ${
              pathname === "/admin/add-customer-vinyl"
                ? "bg-indigo-700 text-white"
                : "bg-indigo-600 text-white hover:bg-indigo-700"
            }`}
          >
            💿 Add Customer Vinyl
          </Link>
          <Link
            href="/admin/import-discogs"
            className={`block w-full text-center py-1.5 px-2 rounded text-xs font-medium transition-colors ${
              pathname === "/admin/import-discogs"
                ? "bg-green-700 text-white"
                : "bg-green-600 text-white hover:bg-green-700"
            }`}
          >
            📥 Import Discogs
          </Link>
          <Link
            href="/admin/cd-only-checker"
            className={`block w-full text-center py-1.5 px-2 rounded text-xs font-medium transition-colors ${
              pathname === "/admin/cd-only-checker"
                ? "bg-red-700 text-white"
                : "bg-red-600 text-white hover:bg-red-700"
            }`}
          >
            💿 CD-Only Finder
          </Link>
        </div>
      </div>
    </div>
  );
}
