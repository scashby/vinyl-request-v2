// src/components/AdminSidebar.tsx - COMPLETE FILE WITH FEATURED EVENTS LINK

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminSidebar() {
  const pathname = usePathname();

  type NavItem = {
    label: string;
    path: string;
    isExternal?: boolean;
    description?: string;
  };

  const navItems: NavItem[] = [
    { label: "Dashboard", path: "/admin/admin-dashboard" },
    { label: "Logout", path: "/" },
  ];

  return (
    <div className="w-64 bg-gray-100 h-screen p-4 border-r fixed overflow-y-auto">
      <h2 className="text-xl font-bold mb-6 text-gray-800">Admin Panel</h2>
      
      {/* Primary Actions */}
      <div className="mb-6">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.path;
            return (
              <li key={item.path}>
                <Link
                  href={item.path}
                  className={`block w-full text-center py-2 rounded font-semibold transition-colors ${
                    isActive
                      ? "bg-emerald-700 text-white"
                      : "bg-emerald-600 text-white hover:bg-emerald-700"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {/* System Overview */}
      <div className="mb-4 p-3 bg-white border border-gray-200 rounded-lg">
        <h3 className="text-sm font-semibold text-gray-800 mb-2">System Overview</h3>
        <p className="text-xs text-gray-600">
          Key admin tools for managing events, collection data, customer engagement, and external systems.
        </p>
      </div>

      {/* Event Management */}
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="text-sm font-semibold text-blue-800 mb-2">🎫 Events & DJ Schedule</h4>
        <div className="space-y-2">
          <Link 
            href="/admin/manage-events"
            className={`block w-full text-center py-1.5 px-2 rounded text-xs font-medium transition-colors ${
              pathname === "/admin/manage-events" 
                ? "bg-blue-700 text-white" 
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            📅 Manage Events
          </Link>
          <Link 
            href="/admin/featured-events"
            className={`block w-full text-center py-1.5 px-2 rounded text-xs font-medium transition-colors ${
              pathname === "/admin/featured-events" 
                ? "bg-orange-700 text-white" 
                : "bg-orange-600 text-white hover:bg-orange-700"
            }`}
          >
            ⭐ Featured Events
          </Link>

          <Link 
            href="/admin/manage-dj-sets"
            className={`block w-full text-center py-1.5 px-2 rounded text-xs font-medium transition-colors ${
              pathname === "/admin/manage-dj-sets" 
                ? "bg-red-700 text-white" 
                : "bg-red-600 text-white hover:bg-red-700"
            }`}
          >
            🎧 DJ Sets
          </Link>
        </div>
      </div>

      {/* Collection Management */}
      <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
        <h4 className="text-sm font-semibold text-purple-800 mb-2">🎵 Collection</h4>
        <div className="space-y-2">
          <Link 
            href="/admin/edit-collection"
            className={`block w-full text-center py-1.5 px-2 rounded text-xs font-medium transition-colors ${
              pathname === "/admin/edit-collection" 
                ? "bg-purple-700 text-white" 
                : "bg-purple-600 text-white hover:bg-purple-700"
            }`}
          >
            📚 Browse & Edit
          </Link>
          <Link 
            href="/admin/import-discogs"
            className={`block w-full text-center py-1.5 px-2 rounded text-xs font-medium transition-colors ${
              pathname === "/admin/import-discogs" 
                ? "bg-purple-700 text-white" 
                : "bg-purple-600 text-white hover:bg-purple-700"
            }`}
          >
            ⬆️ Import Discogs
          </Link>
          <Link 
            href="/admin/1001-review"
            className={`block w-full text-center py-1.5 px-2 rounded text-xs font-medium transition-colors ${
              pathname === "/admin/1001-review" 
                ? "bg-purple-700 text-white" 
                : "bg-purple-600 text-white hover:bg-purple-700"
            }`}
          >
            📖 1001 Albums Review
          </Link>
          <Link 
            href="/admin/cd-only-checker"
            className={`block w-full text-center py-1.5 px-2 rounded text-xs font-medium transition-colors ${
              pathname === "/admin/cd-only-checker" 
                ? "bg-purple-700 text-white" 
                : "bg-purple-600 text-white hover:bg-purple-700"
            }`}
          >
            💿 CD-Only Checker
          </Link>
          <Link 
            href="/admin/enrich-sources"
            className={`block w-full text-center py-1.5 px-2 rounded text-xs font-medium transition-colors ${
              pathname === "/admin/enrich-sources" 
                ? "bg-indigo-700 text-white" 
                : "bg-indigo-600 text-white hover:bg-indigo-700"
            }`}
          >
            🎵 Multi-Source Enrich
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
          <Link 
            href="/admin/enrich-collection"
            className={`block w-full text-center py-1.5 px-2 rounded text-xs font-medium transition-colors ${
              pathname === "/admin/enrich-collection" 
                ? "bg-indigo-700 text-white" 
                : "bg-indigo-600 text-white hover:bg-indigo-700"
            }`}
          >
            📊 Enrich Collection
          </Link>
          {/* 🏆 NEW: Best-Of Lists */}
          <Link 
            href="/admin/best-of"
            className={`block w-full text-center py-1.5 px-2 rounded text-xs font-medium transition-colors ${
              pathname === "/admin/best-of" 
                ? "bg-indigo-700 text-white" 
                : "bg-indigo-600 text-white hover:bg-indigo-700"
            }`}
          >
            🏆 Best-Of Lists
          </Link>
        </div>
      </div>

      {/* Advanced Tools */}
      <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <h4 className="text-sm font-semibold text-amber-800 mb-2">🔍 Advanced Tools</h4>
        <div className="space-y-2">
          <Link 
            href="/admin/organize"
            className={`block w-full text-center py-1.5 px-2 rounded text-xs font-medium transition-colors ${
              pathname === "/admin/organize" 
                ? "bg-amber-700 text-white" 
                : "bg-amber-600 text-white hover:bg-amber-700"
            }`}
          >
            🗂️ Advanced Search
          </Link>
          <Link 
            href="/admin/specialized-searches"
            className={`block w-full text-center py-1.5 px-2 rounded text-xs font-medium transition-colors ${
              pathname === "/admin/specialized-searches" 
                ? "bg-amber-700 text-white" 
                : "bg-amber-600 text-white hover:bg-amber-700"
            }`}
          >
            🔎 Specialized Searches
          </Link>
          <Link 
            href="/admin/diagnostics"
            className={`block w-full text-center py-1.5 px-2 rounded text-xs font-medium transition-colors ${
              pathname === "/admin/diagnostics" 
                ? "bg-amber-700 text-white" 
                : "bg-amber-600 text-white hover:bg-amber-700"
            }`}
          >
            🧪 Diagnostics
          </Link>
        </div>
      </div>

      {/* Engagement & Voting */}
      <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
        <h4 className="text-sm font-semibold text-green-800 mb-2">🗳️ Engagement</h4>
        <div className="space-y-2">
          <Link 
            href="/admin/inner-circle-results"
            className={`block w-full text-center py-1.5 px-2 rounded text-xs font-medium transition-colors ${
              pathname === "/admin/inner-circle-results" 
                ? "bg-green-700 text-white" 
                : "bg-green-600 text-white hover:bg-green-700"
            }`}
          >
            🎟️ Inner Circle Voting
          </Link>
          <Link 
            href="/admin/album-suggestions"
            className={`block w-full text-center py-1.5 px-2 rounded text-xs font-medium transition-colors ${
              pathname === "/admin/album-suggestions" 
                ? "bg-green-700 text-white" 
                : "bg-green-600 text-white hover:bg-green-700"
            }`}
          >
            💡 Album Suggestions
          </Link>
        </div>
      </div>

      {/* Playlists & Curation */}
      <div className="mb-4 p-3 bg-pink-50 border border-pink-200 rounded-lg">
        <h4 className="text-sm font-semibold text-pink-800 mb-2">🎧 Curation</h4>
        <div className="space-y-2">
          <Link 
            href="/admin/playlists"
            className={`block w-full text-center py-1.5 px-2 rounded text-xs font-medium transition-colors ${
              pathname === "/admin/playlists" 
                ? "bg-pink-700 text-white" 
                : "bg-pink-600 text-white hover:bg-pink-700"
            }`}
          >
            🎶 Playlists
          </Link>
          <Link 
            href="/admin/most-wanted"
            className={`block w-full text-center py-1.5 px-2 rounded text-xs font-medium transition-colors ${
              pathname === "/admin/most-wanted" 
                ? "bg-pink-700 text-white" 
                : "bg-pink-600 text-white hover:bg-pink-700"
            }`}
          >
            🔥 Most Wanted
          </Link>
          <Link 
            href="/admin/staff-picks"
            className={`block w-full text-center py-1.5 px-2 rounded text-xs font-medium transition-colors ${
              pathname === "/admin/staff-picks" 
                ? "bg-pink-700 text-white" 
                : "bg-pink-600 text-white hover:bg-pink-700"
            }`}
          >
            ⭐ Staff Picks
          </Link>
        </div>
      </div>

      {/* Social & Communication */}
      <div className="mb-4 p-3 bg-sky-50 border border-sky-200 rounded-lg">
        <h4 className="text-sm font-semibold text-sky-800 mb-2">📣 Social & Comms</h4>
        <div className="space-y-2">
          <Link 
            href="/admin/socials"
            className={`block w-full text-center py-1.5 px-2 rounded text-xs font-medium transition-colors ${
              pathname === "/admin/socials" 
                ? "bg-sky-700 text-white" 
                : "bg-sky-600 text-white hover:bg-sky-700"
            }`}
          >
            📱 Social Scheduler
          </Link>
        </div>
      </div>

      {/* Sale Items */}
      <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h4 className="text-sm font-semibold text-yellow-800 mb-2">💸 Sale Items</h4>
        <div className="space-y-2">
          <Link 
            href="/admin/sale-items"
            className={`block w-full text-center py-1.5 px-2 rounded text-xs font-semibold transition-colors ${
              pathname === "/admin/sale-items" 
                ? "bg-yellow-500 text-gray-900" 
                : "bg-yellow-400 text-gray-900 hover:bg-yellow-500"
            }`}
          >
            🏷️ Manage Sale Items
          </Link>
        </div>
      </div>

      {/* External Systems */}
      <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
        <h4 className="text-sm font-semibold text-gray-800 mb-2">🌐 External Systems</h4>
        <div className="grid grid-cols-2 gap-1 text-xs">
          <a 
            href="https://admin.shopify.com/store/kstusk-d1?ui_locales=en"
            target="_blank"
            rel="noopener noreferrer"
            className="text-center bg-green-600 text-white py-1 px-1 rounded font-medium hover:bg-green-700 transition-colors"
          >
            🛒 Shopify
          </a>
          <a 
            href="https://venmo.com/u/deadwaxdialogues"
            target="_blank"
            rel="noopener noreferrer"
            className="text-center bg-blue-500 text-white py-1 px-1 rounded font-medium hover:bg-blue-600 transition-colors"
          >
            💰 Venmo
          </a>
          <a 
            href="https://calendar.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-center bg-red-500 text-white py-1 px-1 rounded font-medium hover:bg-red-600 transition-colors"
          >
            📆 Calendar
          </a>
          <a 
            href="https://docs.google.com/forms"
            target="_blank"
            rel="noopener noreferrer"
            className="text-center bg-indigo-500 text-white py-1 px-1 rounded font-medium hover:bg-indigo-600 transition-colors"
          >
            📋 Forms
          </a>
          <a 
            href="https://console.hetzner.com/projects"
            target="_blank"
            rel="noopener noreferrer"
            className="text-center bg-red-600 text-white py-1 px-1 rounded font-medium hover:bg-red-700 transition-colors"
          >
            🖥️ Hetzner
          </a>
          <a 
            href="https://vercel.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-center bg-black text-white py-1 px-1 rounded font-medium hover:bg-gray-900 transition-colors"
          >
            ▲ Vercel
          </a>
          <a 
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="text-center bg-emerald-700 text-white py-1 px-1 rounded font-medium hover:bg-emerald-800 transition-colors"
          >
            🗄️ Supabase
          </a>
          <a 
            href="https://www.moo.com/us/account/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-center bg-emerald-700 text-white py-1 px-1 rounded font-medium hover:bg-emerald-800 transition-colors"
          >
            🐄 Moo
          </a>
          <a 
            href="https://www.vistaprint.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-center bg-emerald-700 text-white py-1 px-1 rounded font-medium hover:bg-emerald-800 transition-colors"
          >
            🖨️ Vistaprint
          </a>
          <a 
            href="https://app.canva.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-center bg-emerald-700 text-white py-1 px-1 rounded font-medium hover:bg-emerald-800 transition-colors"
          >
            🎨 Canva
          </a>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
        <h4 className="text-sm font-semibold text-gray-800 mb-2">📊 Status</h4>
        <div className="space-	y-1 text-xs text-gray-600">
          <div>🗳️ Voting: Active</div>
          <div>💡 Suggestions: Active</div>
          <div>💸 Venmo: @deadwaxdialogues</div>
        </div>
      </div>
    </div>
  );
}
