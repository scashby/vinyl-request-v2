// AuthProvider.tsx — strict typing, no "any", for Next.js + Supabase

"use client";

import { ReactNode, createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from 'lib/supabaseClient';
import type { Session } from "@supabase/supabase-js";

interface AuthContextType {
  session: Session | null;
}

const AuthContext = createContext<AuthContextType>({ session: null });

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event: string, session: Session | null) => {
        setSession(session);
        if (!session && pathname.startsWith("/admin")) {
          router.push("/admin/login");
        }
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [router, pathname]);

  return (
    <AuthContext.Provider value={{ session }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useSession must be used within AuthProvider");
  return context;
};
