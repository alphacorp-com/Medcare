"use client";

import React from "react";
import { Menu } from "lucide-react";
import { useAppStore } from "@/lib/store/useAppStore";

interface MobileHeaderProps {
  onMenuToggle?: () => void;
  onProfileToggle?: () => void;
}

export function MobileHeader({ onMenuToggle, onProfileToggle }: MobileHeaderProps) {
  const currentUser = useAppStore((s) => s.currentUser);

  const initials = currentUser
    ? currentUser.fullName
        .split(" ")
        .map((p: string) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "--";

  return (
    <header className="w-full bg-blue-800 text-white flex items-center px-4 py-3 shadow-sm fixed top-0 left-0 right-0 z-40">
      <div className="flex items-center gap-3 w-full min-w-0">
        <button aria-label="open menu" onClick={onMenuToggle} className="p-2 rounded-md bg-blue-700/30 shrink-0">
          <Menu className="w-5 h-5 text-white" />
        </button>

        <div className="flex-1 min-w-0 text-center">
          <div className="text-sm font-semibold truncate">Hôpital central de Foumbot</div>
          <div className="text-[11px] text-blue-100 truncate">1 Avenue de l&apos;Hôpital, Foumbot, Cameroun</div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button onClick={onProfileToggle} aria-label="open profile" className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold">
            {initials}
          </button>
        </div>
      </div>
    </header>
  );
}
