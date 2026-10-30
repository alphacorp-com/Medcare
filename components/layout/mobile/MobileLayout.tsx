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

// The scrolling area of every mobile screen (the body itself never scrolls: see app/[locale]/layout).
export const MOBILE_SCROLL_CONTAINER_ID = "mobile-main";

export function scrollMobileContentToTop() {
  document.getElementById(MOBILE_SCROLL_CONTAINER_ID)?.scrollTo({ top: 0 });
}

// The <body> is a horizontal flex box of the viewport's height that does not scroll. So this
// root takes the full width explicitly (as a flex item it would otherwise shrink to its
// content — and the settings screens, being size containers, give it none) and exactly the
// viewport's height, and <main> is what scrolls.
export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const cardless = CARDLESS_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  return (
    <div className="flex h-dvh w-full min-w-0 flex-1 flex-col overflow-hidden bg-slate-50">
      <MobileHeader />

      {/* Reserves the space of the fixed header (h-16 plus the notch inset). */}
      <div className="h-[calc(4rem+env(safe-area-inset-top))] shrink-0" />

      <main
        id={MOBILE_SCROLL_CONTAINER_ID}
        className="min-h-0 w-full min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pt-3 pb-[calc(6rem+env(safe-area-inset-bottom))]"
      >
        <div
          className={cn(
            "flex w-full min-w-0 max-w-full min-h-[60vh] flex-col",
            cardless ? "" : "overflow-hidden rounded-2xl bg-white p-3 shadow-sm"
          )}
        >
          {children}
        </div>
      </main>

      <MobileBottomNav />
      <TableCardLabels />
    </div>
  );
}
