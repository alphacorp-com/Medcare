"use client";

import React from "react";
import { usePathname } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { MobileHeader } from "./MobileHeader";
import { MobileBottomNav } from "./MobileBottomNav";
import { TableCardLabels } from "./TableCardLabels";

// Screens whose sections are already cards: no white card around them, so cards are not nested
// on a phone (the settings pages and their own section cards).
const CARDLESS_PREFIXES = ["/settings"];

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const cardless = CARDLESS_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  return (
    <div className="min-h-screen bg-slate-50 pb-[calc(6rem+env(safe-area-inset-bottom))] flex flex-col overflow-x-hidden">
      <MobileHeader />

      {/* Reserves the space of the fixed header (h-16 plus the notch inset). */}
      <div className="h-[calc(4rem+env(safe-area-inset-top))] shrink-0" />

      <main className="flex-1 px-3 pt-3 overflow-y-auto overflow-x-hidden">
        <div className="mx-auto w-full max-w-full min-w-0">
          <div
            className={cn(
              "w-full max-w-full min-w-0 min-h-[60vh] flex flex-col",
              cardless ? "" : "bg-white rounded-2xl shadow-sm p-3 overflow-hidden"
            )}
          >
            {children}
          </div>
        </div>
      </main>

      <MobileBottomNav />
      <TableCardLabels />
    </div>
  );
}
