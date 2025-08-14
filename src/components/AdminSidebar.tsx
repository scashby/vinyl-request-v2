// src/components/AdminSidebar.tsx
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
    { label: "Manage Events", path: "/admin/manage-events" },
    { label: "Manage Queues", path: "/admin/edit-queue" },
    
    // Collection Management
    { label: "Import from Discogs", path: "/admin/import-discogs" },
    { label: "Edit Collection", path: "/admin/edit-collection" },
    { label: "Add Album", path: "/admin/add-album" },
    { label: "Add Customer Vinyl", path: "/admin/add-customer-vinyl" },
    
    // Content Management
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
          const isAudioRecognition = item.path.includes('/audio-recognition');
          
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
                    : "text-gray-700 hover:bg-gray-200 hover:text-blue-600"
                  }
                `}
              >
                <span className="flex-1">{item.label}</span>
                

              </Link>
              
            </li>
          );
        })}
      </ul>
      

        

        {/* Quick Actions */}
        <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
          <h4 className="text-sm font-semibold text-purple-800 mb-2">Quick Actions</h4>
          <div className="space-y-2">
            <Link 
              href="/admin/edit-collection"
              className="block w-full text-center bg-green-600 text-white py-1.5 px-2 rounded text-xs font-medium hover:bg-green-700 transition-colors"
            >
              📚 Edit Collection
            </Link>
          </div>
        </div>
    </div>
  );
}