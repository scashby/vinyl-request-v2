// src/components/AdminSidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface AdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AdminSidebar({ isOpen, onClose }: AdminSidebarProps) {
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
    <>
      {/* Desktop Sidebar - always visible on lg+ */}
      <aside className={`
        fixed top-0 left-0 z-40 h-screen transition-transform duration-300 ease-in-out
        w-48 bg-gray-100 border-r border-gray-200 overflow-y-auto
        lg:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-4">
          {/* Close button - only visible on mobile */}
          <div className="lg:hidden flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-800">Admin Panel</h2>
            <button
              onClick={onClose}
              className="p-1 rounded-md hover:bg-gray-200"
              aria-label="Close menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Desktop title - hidden on mobile */}
          <h2 className="hidden lg:block text-lg font-bold mb-6 text-gray-800">Admin Panel</h2>
          
          {/* Public Site Link */}
          <div className="mb-6">
            <Link 
              href="/" 
              target="_blank"
              className="block w-full text-center py-2 px-3 bg-blue-600 text-white rounded-md text-sm font-bold hover:bg-blue-700 transition-colors"
            >
              ↗ View Public Site
            </Link>
          </div>
          
          {/* Core Navigation */}
          <div className="mb-6">
            <ul className="space-y-2">
              {navItems.map((item) => {
                const isActive = pathname === item.path;
                return (
                  <li key={item.path}>
                    <Link
                      href={item.path}
                      className={`
                        block p-2 rounded-md text-sm transition-colors
                        ${isActive 
                          ? "bg-blue-100 text-blue-700 font-semibold border-l-4 border-blue-500" 
                          : "text-gray-700 hover:bg-gray-200 hover:text-blue-600"
                        }
                      `}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Collection Management */}
          <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
            <h4 className="text-sm font-semibold text-purple-800 mb-2">🎵 Collection</h4>
            <div className="space-y-2">
              <Link 
                href="/edit-collection"
                target="_blank"
                className={`block w-full text-center py-1.5 px-2 rounded text-xs font-medium transition-colors ${
                  pathname === "/edit-collection" 
                    ? "bg-purple-700 text-white" 
                    : "bg-purple-600 text-white hover:bg-purple-700"
                }`}
              >
                📚 Browse & Edit
              </Link>
            </div>
          </div>

          {/* Merchandise */}
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
            <h4 className="text-sm font-semibold text-emerald-800 mb-2">💰 Merchandise</h4>
            <div className="space-y-2">
              <Link 
                href="/admin/sale-items"
                className={`block w-full text-center py-1.5 px-2 rounded text-xs font-medium transition-colors ${
                  pathname === "/admin/sale-items" 
                    ? "bg-emerald-700 text-white" 
                    : "bg-emerald-600 text-white hover:bg-emerald-700"
                }`}
              >
                💿 Sale Items
              </Link>
              <div className="pt-2 border-t border-emerald-300">
                <div className="text-xs text-emerald-700 font-semibold mb-1 px-1">External:</div>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <a href="https://admin.shopify.com/store/kstusk-d1?ui_locales=en" target="_blank" rel="noopener noreferrer" className="text-center bg-emerald-700 text-white py-1 px-1 rounded font-medium hover:bg-emerald-800 transition-colors">🛍️ Shopify</a>
                  <a href="https://www.discogs.com/seller/socialblunders/profile" target="_blank" rel="noopener noreferrer" className="text-center bg-emerald-700 text-white py-1 px-1 rounded font-medium hover:bg-emerald-800 transition-colors">💿 Discogs</a>
                  <a href="https://www.moo.com/us/account/" target="_blank" rel="noopener noreferrer" className="text-center bg-emerald-700 text-white py-1 px-1 rounded font-medium hover:bg-emerald-800 transition-colors">🐄 Moo</a>
                  <a href="https://www.vistaprint.com/" target="_blank" rel="noopener noreferrer" className="text-center bg-emerald-700 text-white py-1 px-1 rounded font-medium hover:bg-emerald-800 transition-colors">🖨️ Vista</a>
                </div>
              </div>
            </div>
          </div>

          {/* Data Quality */}
          <div className="mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
            <h4 className="text-sm font-semibold text-indigo-800 mb-2">🔧 Data Quality</h4>
            <div className="space-y-2">
              <Link 
                href="/admin/diagnostics"
                className={`block w-full text-center py-1.5 px-2 rounded text-xs font-medium transition-colors ${
                  pathname === "/admin/diagnostics" 
                    ? "bg-indigo-700 text-white" 
                    : "bg-indigo-600 text-white hover:bg-indigo-700"
                }`}
              >
                🔍 Diagnostics
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
            </div>
          </div>

          {/* Event Management */}
          <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <h4 className="text-sm font-semibold text-orange-800 mb-2">📅 Events</h4>
            <div className="space-y-2">
              <Link 
                href="/admin/manage-events"
                className={`block w-full text-center py-1.5 px-2 rounded text-xs font-medium transition-colors ${
                  pathname === "/admin/manage-events" 
                    ? "bg-orange-700 text-white" 
                    : "bg-orange-600 text-white hover:bg-orange-700"
                }`}
              >
                📅 Manage Events
              </Link>
              <Link 
                href="/admin/event-types"
                className={`block w-full text-center py-1.5 px-2 rounded text-xs font-medium transition-colors ${
                  pathname === "/admin/event-types" 
                    ? "bg-orange-700 text-white" 
                    : "bg-orange-600 text-white hover:bg-orange-700"
                }`}
              >
                🧩 Event Types
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
              <Link 
                href="/admin/edit-queue"
                className={`block w-full text-center py-1.5 px-2 rounded text-xs font-medium transition-colors ${
                  pathname === "/admin/edit-queue" 
                    ? "bg-orange-700 text-white" 
                    : "bg-orange-600 text-white hover:bg-orange-700"
                }`}
              >
                🎵 Queues
              </Link>
            </div>
          </div>

          {/* Vinyl Games */}
          <div className="mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
            <h4 className="text-sm font-semibold text-indigo-800 mb-2">🎮 Vinyl Games</h4>
            <div className="space-y-2">
              <Link
                href="/admin/games"
                className={`block w-full text-center py-1.5 px-2 rounded text-xs font-medium transition-colors ${
                  pathname === "/admin/games"
                    ? "bg-indigo-700 text-white"
                    : "bg-indigo-600 text-white hover:bg-indigo-700"
                }`}
              >
                🎛️ Game Sessions
              </Link>
              <Link
                href="/admin/games/bingo"
                className={`block w-full text-center py-1.5 px-2 rounded text-xs font-medium transition-colors ${
                  pathname === "/admin/games/bingo"
                    ? "bg-indigo-700 text-white"
                    : "bg-indigo-600 text-white hover:bg-indigo-700"
                }`}
              >
                🎯 Bingo Cards
              </Link>
              <Link
                href="/admin/games/templates"
                className={`block w-full text-center py-1.5 px-2 rounded text-xs font-medium transition-colors ${
                  pathname === "/admin/games/templates"
                    ? "bg-indigo-700 text-white"
                    : "bg-indigo-600 text-white hover:bg-indigo-700"
                }`}
              >
                🧩 Game Templates
              </Link>
            </div>
          </div>

          {/* Content */}
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <h4 className="text-sm font-semibold text-green-800 mb-2">📝 Content</h4>
            <div className="space-y-2">
              <Link 
                href="/admin/edit-about"
                className={`block w-full text-center py-1.5 px-2 rounded text-xs font-medium transition-colors ${
                  pathname === "/admin/edit-about" 
                    ? "bg-green-700 text-white" 
                    : "bg-green-600 text-white hover:bg-green-700"
                }`}
              >
                📄 About Page
              </Link>
              <Link 
                href="/admin/playlists"
                className={`block w-full text-center py-1.5 px-2 rounded text-xs font-medium transition-colors ${
                  pathname === "/admin/playlists" 
                    ? "bg-green-700 text-white" 
                    : "bg-green-600 text-white hover:bg-green-700"
                }`}
              >
                🎶 Playlists
              </Link>
              <Link 
                href="/admin/socials"
                className={`block w-full text-center py-1.5 px-2 rounded text-xs font-medium transition-colors ${
                  pathname === "/admin/socials" 
                    ? "bg-green-700 text-white" 
                    : "bg-green-600 text-white hover:bg-green-700"
                }`}
              >
                🌐 Social Embeds
              </Link>
            </div>
          </div>

          {/* External Tools */}
          <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <h4 className="text-sm font-semibold text-slate-800 mb-2">🔗 External Tools</h4>
            <div className="grid grid-cols-2 gap-1 text-xs">
              <a href="https://blog.deadwaxdialogues.com/wp-admin/" target="_blank" rel="noopener noreferrer" className="text-center bg-slate-600 text-white py-1 px-1 rounded font-medium hover:bg-slate-700 transition-colors">📝 WP</a>
              <a href="https://console.hetzner.com/projects" target="_blank" rel="noopener noreferrer" className="text-center bg-red-600 text-white py-1 px-1 rounded font-medium hover:bg-red-700 transition-colors">🖥️ Hetzner</a>
              <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" className="text-center bg-black text-white py-1 px-1 rounded font-medium hover:bg-gray-900 transition-colors">▲ Vercel</a>
              <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-center bg-emerald-600 text-white py-1 px-1 rounded font-medium hover:bg-emerald-700 transition-colors">🟩 Supabase</a>
              <a href="https://business.facebook.com/" target="_blank" rel="noopener noreferrer" className="text-center bg-blue-600 text-white py-1 px-1 rounded font-medium hover:bg-blue-700 transition-colors">📘 FB</a>
              <a href="https://login.buffer.com/login" target="_blank" rel="noopener noreferrer" className="text-center bg-sky-600 text-white py-1 px-1 rounded font-medium hover:bg-sky-700 transition-colors">📱 Buffer</a>
              <a href="https://admin.google.com/" target="_blank" rel="noopener noreferrer" className="text-center bg-red-500 text-white py-1 px-1 rounded font-medium hover:bg-red-600 transition-colors">🔍 Google</a>
              <a href="https://login.squarespace.com/api/1/login/" target="_blank" rel="noopener noreferrer" className="text-center bg-gray-800 text-white py-1 px-1 rounded font-medium hover:bg-gray-900 transition-colors">⬛ Square</a>
              <a href="https://app.dub.co/login" target="_blank" rel="noopener noreferrer" className="text-center bg-violet-600 text-white py-1 px-1 rounded font-medium hover:bg-violet-700 transition-colors">🔗 Dub</a>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
// AUDIT: inspected, no changes.
