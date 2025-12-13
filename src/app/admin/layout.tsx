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
    if (session === undefined) return;

    if (!session && pathname !== "/admin/login") {
      router.replace("/admin/login");
    } else {
      setIsLoading(false);
    }
  }, [session, pathname, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-gray-900">
        Loading…
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-white text-gray-900 flex">
      <AdminSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col">
        <header className="border-b border-gray-200 p-4 flex items-center justify-between">
          <button
            className="md:hidden text-sm font-medium"
            onClick={() => setSidebarOpen(true)}
          >
            Menu
          </button>
          <span className="text-sm text-gray-500">Admin Panel</span>
        </header>

        <main className="flex-1 p-4">
          {children}
        </main>
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
