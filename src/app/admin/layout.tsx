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

  useEffect(() => {
    // Wait a tick for auth to initialize
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const isLoginPage = pathname === "/admin/login";
    
    // Only redirect after loading is complete
    if (!isLoading && !isLoginPage && session === null) {
      router.push("/admin/login");
    }
  }, [session, router, pathname, isLoading]);

  const isLoginPage = pathname === "/admin/login";
  
  // Show nothing while loading
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  // Show nothing if not logged in and not on login page
  if (!isLoginPage && session === null) return null;

  return <>{children}</>;
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <RequireAuth>
        <div className="flex">
          <AdminSidebar />
          <div className="ml-48 w-full p-4">
            {children}
          </div>
        </div>
      </RequireAuth>
    </AuthProvider>
  );
}