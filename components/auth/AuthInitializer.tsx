"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import { useAppStore } from "@/lib/store/useAppStore";
import { useUsersStore } from "@/lib/store/useUsersStore";

export function AuthInitializer({ children }: { children: React.ReactNode }) {
  const { currentUser, setUser, setActiveModules } = useAppStore();
  const users = useUsersStore((state) => state.users);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      const token = Cookies.get("auth-token");
      if (token) {
        const user = users.find((u) => u.id === token);
        if (user) {
          setUser({
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            role: user.role,
          });
          setActiveModules(user.modules);
        } else {
          // If token exists but user not found (mock data changed?), clear it
          Cookies.remove("auth-token");
        }
      }
    }
    setIsHydrated(true);
  }, [currentUser, users, setUser, setActiveModules]);

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
