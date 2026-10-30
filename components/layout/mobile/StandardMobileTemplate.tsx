"use client";

import React from "react";
import { MobileHeader } from "./MobileHeader";
import { MobileBottomNav } from "./MobileBottomNav";

// noRoundedContainer: no white card around the content — for screens whose sections are
// already cards (settings), so cards are not nested two or three deep on a phone.
export default function StandardMobileTemplate({
  title,
  subtitle,
  actions,
  children,
  noRoundedContainer = false,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  noRoundedContainer?: boolean;
}) {
  return (
    <div className="min-h-screen bg-slate-50 pb-[calc(6rem+env(safe-area-inset-bottom))] flex flex-col overflow-x-hidden">
      <MobileHeader />

      <div className="h-[calc(4rem+env(safe-area-inset-top))] shrink-0" />

      <main className="flex-1 px-2 overflow-y-auto overflow-x-hidden">
        <div className="mx-auto w-full max-w-full min-w-0">
          <div className={
            `w-full max-w-full min-w-0 ${noRoundedContainer ? "min-h-[60vh] overflow-visible" : "bg-white rounded-2xl shadow-sm p-3 min-h-[60vh] overflow-hidden"} flex flex-col`
          }>
            <div className={`mb-3 min-w-0 text-center ${noRoundedContainer ? "pt-1" : ""}`}>
              <div className="text-base font-semibold text-slate-900 truncate">{title}</div>
              {subtitle && <div className="text-[12px] text-slate-500 truncate">{subtitle}</div>}
            </div>

            {actions && <div className="mb-3">{actions}</div>}

            <div className={`flex-1 min-w-0 ${noRoundedContainer ? "" : "overflow-hidden"}`}>{children}</div>
          </div>
        </div>
      </main>

      <MobileBottomNav />
    </div>
  );
}
