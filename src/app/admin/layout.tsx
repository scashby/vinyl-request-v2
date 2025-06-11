// /src/app/admin/layout.tsx
"use client";

import { ReactNode, useEffect } from "react";
import { AuthProvider, useSession } from "../../components/AuthProvider";
import { useRouter } from "next/navigation";

function RequireAuth({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session === null) {
      router.push("/admin/login");
    }
  }, [session, router]);

  if (session === null) return null; // Or a loading spinner

  return <>{children}</>;
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <RequireAuth>{children}</RequireAuth>
    </AuthProvider>
  );
}
