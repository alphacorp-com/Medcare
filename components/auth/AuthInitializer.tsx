"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useAppStore } from "@/lib/store/useAppStore";

export function AuthInitializer({ children }: { children: React.ReactNode }) {
  const { currentUser, setUser, setActiveModules } = useAppStore();
  const { data: session, status } = useSession();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      setUser({
        id: session.user.id,
        fullName: session.user.name || "",
        email: session.user.email || "",
        role: session.user.role,
      });
      setActiveModules(session.user.modules || []);
    } else if (status === "unauthenticated") {
      setUser(null);
    }
    
    if (status !== "loading") {
      setIsHydrated(true);
    }
  }, [session, status, setUser, setActiveModules]);

  // Optionally prevent flash of unauthenticated content
  // But since we have middleware, if we get here we should have a token if it's protected
  // However, Zustand is async to hydrate in this effect
  
  if (!isHydrated) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">Initializing System...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
