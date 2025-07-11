// src/components/AdminSidebar.tsx - Updated with audio recognition links

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminSidebar() {
  const pathname = usePathname();

  const navItems = [
    { label: "Dashboard", path: "/admin/admin-dashboard" },
    { label: "Manage Events", path: "/admin/manage-events" },
    { label: "Manage Queues", path: "/admin/edit-queue" },
    
    // Audio Recognition Section
    { label: "Audio Recognition", path: "/admin/audio-recognition", isNew: true },
    { label: "Now Playing Control", path: "/admin/set-now-playing" },
    
    // Collection Management
    { label: "Import from Discogs", path: "/admin/import-discogs" },
    { label: "Edit Collection", path: "/admin/edit-collection" },
    { label: "Add Album", path: "/admin/add-album" },
    { label: "Add Customer Vinyl", path: "/admin/add-customer-vinyl" },
    
    // Content Management
    { label: "Edit Playlists", path: "/admin/playlists" },
    { label: "Most Wanted", path: "/admin/most-wanted" },
    { label: "Social Embeds", path: "/admin/socials" },
    
    // Quick Links
    { 
      label: "🖥️ TV Display", 
      path: "/now-playing-tv", 
      isExternal: true,
      description: "Open in new tab for casting"
    },
    { label: "Logout", path: "/" },
  ];

  return (
    <div className="w-48 bg-gray-100 h-screen p-4 border-r fixed overflow-y-auto">
      <h2 className="text-lg font-bold mb-6 text-gray-800">Admin Panel</h2>
      
      <ul className="space-y-2">
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <li key={item.path}>
              <Link
                href={item.path}
                target={item.isExternal ? "_blank" : undefined}
                rel={item.isExternal ? "noopener noreferrer" : undefined}
                className={`
                  flex items-center justify-between p-2 rounded-md text-sm transition-colors
                  ${isActive 
                    ? "bg-blue-100 text-blue-700 font-semibold border-l-4 border-blue-500" 
                    : "text-gray-700 hover:bg-gray-200 hover:text-blue-600"
                  }
                  ${item.isExternal ? "hover:bg-purple-50 hover:text-purple-600" : ""}
                `}
              >
                <span className="flex-1">{item.label}</span>
                
                {/* New badge */}
                {item.isNew && (
                  <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium">
                    NEW
                  </span>
                )}
                
                {/* External link indicator */}
                {item.isExternal && (
                  <span className="text-xs ml-1">↗</span>
                )}
              </Link>
              
              {/* Description for external links */}
              {item.description && (
                <p className="text-xs text-gray-500 mt-1 pl-2">
                  {item.description}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      
      {/* Audio Recognition Status Widget */}
      <div className="mt-8 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="text-sm font-semibold text-blue-800 mb-2">
          Audio Recognition
        </h3>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-600">Status:</span>
            <span className="text-green-600 font-medium">●  Active</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Service:</span>
            <span className="text-gray-800">ACRCloud</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Last scan:</span>
            <span className="text-gray-800">2 min ago</span>
          </div>
        </div>
        
        <Link 
          href="/admin/audio-recognition"
          className="block w-full mt-3 text-center bg-blue-600 text-white py-1.5 px-3 rounded text-xs font-medium hover:bg-blue-700 transition-colors"
        >
          Configure
        </Link>
      </div>
      
      {/* Quick Cast Button */}
      <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
        <Link 
          href="/now-playing-tv"
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full text-center bg-purple-600 text-white py-2 px-3 rounded text-sm font-medium hover:bg-purple-700 transition-colors"
        >
          🖥️ Cast to TV
        </Link>
        <p className="text-xs text-purple-600 mt-1 text-center">
          Opens TV display for casting
        </p>
      </div>
    </div>
  );
}