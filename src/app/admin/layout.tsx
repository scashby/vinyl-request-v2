// /src/app/admin/layout.tsx
"use client";

import { ReactNode, useEffect, useState } from "react";
import { AuthProvider, useSession } from "components/AuthProvider";
import { useRouter, usePathname } from "next/navigation";
import AdminSidebar from "components/AdminSidebar";

function RequireAuth({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const isLoginPage = pathname === "/admin/login";
    if (!isLoading && !isLoginPage && session === null) {
      router.push("/admin/login");
    }
  }, [session, router, pathname, isLoading]);

  // Close sidebar when route changes on mobile
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const isLoginPage = pathname === "/admin/login";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white text-gray-900">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!isLoginPage && session === null) return null;

  return (
    <div className="relative min-h-screen bg-white text-gray-900">
      {/* Mobile Menu Button - only visible on mobile */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-gray-800 text-white rounded-md shadow-lg"
        aria-label="Toggle menu"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {sidebarOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Overlay for mobile - only shows when sidebar is open */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <AdminSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content */}
      <div className="lg:ml-48 min-h-screen">
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <RequireAuth>{children}</RequireAuth>
    </AuthProvider>
  );
}
// AUDIT: inspected, no changes.
