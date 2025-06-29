// /src/app/admin/layout.tsx
"use client";

import { ReactNode, useEffect } from "react";
import { AuthProvider, useSession } from "components/AuthProvider";
import { useRouter } from "next/navigation";
import AdminSidebar from "components/AdminSidebar";

function RequireAuth({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const router = useRouter();

  useEffect(() => {
    const isLoginPage = window.location.pathname === "/admin/login";
    if (!isLoginPage && session === null) {
      router.push("/admin/login");
    }
  }, [session, router]);

  const isLoginPage = typeof window !== "undefined" && window.location.pathname === "/admin/login";
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
