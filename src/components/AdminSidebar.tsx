// src/components/AdminSidebar.tsx - UPDATED with Edit About page
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminSidebar() {
  const pathname = usePathname();

  type NavItem = {
    label: string;
    path: string;
    isNew?: boolean;
    isExternal?: boolean;
    description?: string;
  };

  const navItems: NavItem[] = [
    { label: "Dashboard", path: "/admin/admin-dashboard" },
    
    // Audio Recognition Section
    { label: "Audio Recognition", path: "/admin/audio-recognition", isNew: true },
    { label: "Audio Debug", path: "/admin/audio-debug", isNew: true },
    
    // Event Management
    { label: "Manage Events", path: "/admin/manage-events" },
    { label: "Manage Queues", path: "/admin/edit-queue" },
    
    // Collection Management
    { label: "Import from Discogs", path: "/admin/import-discogs" },
    { label: "Edit Collection", path: "/admin/edit-collection" },
    { label: "Add Album", path: "/admin/add-album" },
    { label: "Add Customer Vinyl", path: "/admin/add-customer-vinyl" },
    
    // Content Management
    { label: "Edit About Page", path: "/admin/edit-about", isNew: true },
    { label: "Most Wanted", path: "/admin/most-wanted" },
    { label: "Social Embeds", path: "/admin/socials" },
    
    // Quick Links
    { label: "Logout", path: "/" },
  ];

  return (
    <div className="w-48 bg-gray-100 h-screen p-4 border-r fixed overflow-y-auto">
      <h2 className="text-lg font-bold mb-6 text-gray-800">Admin Panel</h2>
      
      <ul className="space-y-2">
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          const isAudioRecognition = item.path.includes('/audio-recognition') || item.path.includes('/audio-debug');
          const isContentManagement = item.path.includes('/edit-about') || item.path.includes('/most-wanted') || item.path.includes('/socials');
          
          return (
            <li key={item.path}>
              <Link
                href={item.path}
                className={`
                  flex items-center justify-between p-2 rounded-md text-sm transition-colors
                  ${isActive 
                    ? "bg-blue-100 text-blue-700 font-semibold border-l-4 border-blue-500" 
                    : isAudioRecognition
                    ? "text-purple-700 hover:bg-purple-50 hover:text-purple-800 pl-4"
                    : isContentManagement
                    ? "text-green-700 hover:bg-green-50 hover:text-green-800 pl-4"
                    : "text-gray-700 hover:bg-gray-200 hover:text-blue-600"
                  }
                `}
              >
                <span className="flex-1">{item.label}</span>
                {item.isNew && (
                  <span className="text-xs bg-green-500 text-white px-2 py-1 rounded-full">
                    NEW
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Audio Recognition Quick Actions */}
      <div className="mt-6 p-3 bg-purple-50 border border-purple-200 rounded-lg">
        <h4 className="text-sm font-semibold text-purple-800 mb-2">🎵 Audio Recognition</h4>
        <div className="space-y-2">
          <Link 
            href="/admin/audio-recognition"
            className="block w-full text-center bg-purple-600 text-white py-1.5 px-2 rounded text-xs font-medium hover:bg-purple-700 transition-colors"
          >
            🎧 Control Panel
          </Link>
          <Link 
            href="/admin/audio-debug"
            className="block w-full text-center bg-orange-600 text-white py-1.5 px-2 rounded text-xs font-medium hover:bg-orange-700 transition-colors"
          >
            🔧 Debug Tool
          </Link>
          {/* TV Display Link to public route */}
          <a 
            href="/tv-display"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              console.log('Sidebar TV Display clicked, URL:', '/tv-display');
              console.log('Current location:', window.location.href);
            }}
            className="block w-full text-center bg-gray-600 text-white py-1.5 px-2 rounded text-xs font-medium hover:bg-gray-700 transition-colors"
          >
            📺 TV Display
          </a>
        </div>
      </div>

      {/* Content Management Quick Actions */}
      <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
        <h4 className="text-sm font-semibold text-green-800 mb-2">📝 Content Management</h4>
        <div className="space-y-2">
          <Link 
            href="/admin/edit-about"
            className="block w-full text-center bg-green-600 text-white py-1.5 px-2 rounded text-xs font-medium hover:bg-green-700 transition-colors"
          >
            📄 Edit About Page
          </Link>
          <Link 
            href="/admin/most-wanted"
            className="block w-full text-center bg-blue-600 text-white py-1.5 px-2 rounded text-xs font-medium hover:bg-blue-700 transition-colors"
          >
            ⭐ Most Wanted List
          </Link>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="text-sm font-semibold text-blue-800 mb-2">⚡ Quick Actions</h4>
        <div className="space-y-2">
          <Link 
            href="/admin/edit-collection"
            className="block w-full text-center bg-blue-600 text-white py-1.5 px-2 rounded text-xs font-medium hover:bg-blue-700 transition-colors"
          >
            📚 Edit Collection
          </Link>
          <Link 
            href="/admin/add-album"
            className="block w-full text-center bg-indigo-600 text-white py-1.5 px-2 rounded text-xs font-medium hover:bg-indigo-700 transition-colors"
          >
            ➕ Add Album
          </Link>
        </div>
      </div>
    </div>
  );
}