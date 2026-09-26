"use client";

import React from "react";
import { MobileHeader } from "./MobileHeader";
import { MobileBottomNav } from "./MobileBottomNav";

export default function StandardMobileTemplate({
  title,
  subtitle,
  actions,
  children,
  showSearchSlot = true,
  noRoundedContainer = false,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  showSearchSlot?: boolean;
  noRoundedContainer?: boolean;
}) {
  return (
    <div className="min-h-screen bg-slate-50 pb-[calc(6rem+env(safe-area-inset-bottom))] flex flex-col overflow-x-hidden">
      <MobileHeader />

      <div className="h-[calc(4rem+env(safe-area-inset-top))] shrink-0" />

      <main className="flex-1 px-2 overflow-y-auto overflow-x-hidden">
        <div className="mx-auto w-full max-w-full min-w-0">
          <div className={
            `w-full max-w-full min-w-0 bg-white ${noRoundedContainer ? "p-0 min-h-[60vh] overflow-visible" : "rounded-2xl shadow-sm p-3 min-h-[60vh] overflow-hidden"} flex flex-col`
          }>
            <div className="mb-3 min-w-0 text-center">
              <div className="text-base font-semibold text-slate-900 truncate">{title}</div>
              {subtitle && <div className="text-[12px] text-slate-500 truncate">{subtitle}</div>}
            </div>

            {actions && <div className="mb-3">{actions}</div>}

            {showSearchSlot && (
              <div className="mb-3">
                <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-400">Rechercher …</div>
              </div>
            )}

            <div className="flex-1 min-w-0 overflow-hidden">{children}</div>
          </div>
        </div>
      </main>

      <MobileBottomNav />
    </div>
  );
}
