// src/components/AdminSidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface AdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

type PageLink = { label: string; path: string };
type ExternalLink = { label: string; href: string };

// 1. Tools that work directly on the site's own pages.
const SITE_PAGE_LINKS: PageLink[] = [
  { label: "📅 Manage Events", path: "/admin/manage-events" },
  { label: "🧩 Event Types", path: "/admin/event-types" },
  { label: "🖼️ Image Library", path: "/admin/image-library" },
  { label: "🎧 DJ Sets", path: "/admin/manage-dj-sets" },
  { label: "🎮 Games", path: "/admin/games" },
  { label: "🏠 Home Page", path: "/admin/edit-home" },
  { label: "📄 About Page", path: "/admin/edit-about" },
  { label: "🛍️ Merch Page", path: "/admin/edit-merch" },
  { label: "🌐 Social Embeds", path: "/admin/socials" },
];

// 2. External sites/services that a specific site page pulls from or
// links out to directly (the blog behind Dialogues, the socials a page
// embeds or links to).
const SITE_TIED_EXTERNAL_LINKS: ExternalLink[] = [
  { label: "📝 WordPress", href: "https://blog.deadwaxdialogues.com/wp-admin/" },
  { label: "📘 Facebook", href: "https://business.facebook.com/" },
  { label: "📷 Instagram", href: "https://www.instagram.com/deadwaxdialogues/" },
  { label: "🎵 Spotify", href: "https://open.spotify.com/user/deadwaxdialogues" },
];

// 3. External administrative tools: hosting/infra, and merch/print
// vendors (where the merch page sends buyers, but managed as vendor
// accounts rather than site content).
const ADMIN_EXTERNAL_LINKS: ExternalLink[] = [
  { label: "▲ Vercel", href: "https://vercel.com" },
  { label: "🖥️ Hetzner", href: "https://console.hetzner.com/projects" },
  { label: "🟩 Supabase", href: "https://supabase.com/dashboard" },
  { label: "🔍 Google", href: "https://admin.google.com/" },
  { label: "⬛ Square", href: "https://login.squarespace.com/api/1/login/" },
  { label: "🛍️ Shopify", href: "https://admin.shopify.com/store/kstusk-d1?ui_locales=en" },
  { label: "💿 Discogs", href: "https://www.discogs.com/seller/socialblunders/profile" },
  { label: "🐄 Moo", href: "https://www.moo.com/us/account/" },
  { label: "🖨️ Vistaprint", href: "https://www.vistaprint.com/" },
];

// 4. External marketing tools.
const MARKETING_EXTERNAL_LINKS: ExternalLink[] = [
  { label: "📱 Buffer", href: "https://login.buffer.com/login" },
  { label: "🔗 Dub.co", href: "https://app.dub.co/login" },
];

function SectionLinks({ pathname, items }: { pathname: string; items: PageLink[] }) {
  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const isActive = pathname === item.path;
        return (
          <li key={item.path}>
            <Link
              href={item.path}
              className={`block p-2 rounded-md text-sm transition-colors ${
                isActive
                  ? "bg-blue-100 text-blue-700 font-semibold border-l-4 border-blue-500"
                  : "text-gray-700 hover:bg-gray-200 hover:text-blue-600"
              }`}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function ExternalLinkGrid({ items, colorClass }: { items: ExternalLink[]; colorClass: string }) {
  return (
    <div className="grid grid-cols-2 gap-1 text-xs">
      {items.map((item) => (
        <a
          key={item.href}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className={`text-center py-1.5 px-1 rounded font-medium text-white transition-colors ${colorClass}`}
        >
          {item.label}
        </a>
      ))}
    </div>
  );
}

export default function AdminSidebar({ isOpen, onClose }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={`
        fixed top-0 left-0 z-40 h-screen transition-transform duration-300 ease-in-out
        w-52 bg-gray-100 border-r border-gray-200 overflow-y-auto
        lg:translate-x-0
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
      `}
    >
      <div className="p-4">
        {/* Close button - only visible on mobile */}
        <div className="lg:hidden flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-gray-800">Admin Panel</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-200" aria-label="Close menu">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <h2 className="hidden lg:block text-lg font-bold mb-6 text-gray-800">Admin Panel</h2>

        <div className="mb-6">
          <Link
            href="/"
            target="_blank"
            className="block w-full text-center py-2 px-3 bg-blue-600 text-white rounded-md text-sm font-bold hover:bg-blue-700 transition-colors"
          >
            ↗ View Public Site
          </Link>
        </div>

        <div className="mb-6">
          <SectionLinks
            pathname={pathname}
            items={[
              { label: "Dashboard", path: "/admin/admin-dashboard" },
              { label: "Logout", path: "/" },
            ]}
          />
        </div>

        {/* 1. Site pages */}
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <h4 className="text-sm font-semibold text-green-800 mb-2">📝 Site Pages</h4>
          <SectionLinks pathname={pathname} items={SITE_PAGE_LINKS} />
        </div>

        {/* 2. External sites tied to site pages */}
        <div className="mb-4 p-3 bg-sky-50 border border-sky-200 rounded-lg">
          <h4 className="text-sm font-semibold text-sky-800 mb-2">🔗 Tied to Site Pages</h4>
          <ExternalLinkGrid items={SITE_TIED_EXTERNAL_LINKS} colorClass="bg-sky-600 hover:bg-sky-700" />
        </div>

        {/* 3. External administrative tools */}
        <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <h4 className="text-sm font-semibold text-slate-800 mb-2">🛠️ Administrative</h4>
          <ExternalLinkGrid items={ADMIN_EXTERNAL_LINKS} colorClass="bg-slate-600 hover:bg-slate-700" />
        </div>

        {/* 4. External marketing tools */}
        <div className="mb-4 p-3 bg-violet-50 border border-violet-200 rounded-lg">
          <h4 className="text-sm font-semibold text-violet-800 mb-2">📣 Marketing</h4>
          <ExternalLinkGrid items={MARKETING_EXTERNAL_LINKS} colorClass="bg-violet-600 hover:bg-violet-700" />
        </div>
      </div>
    </aside>
  );
}
