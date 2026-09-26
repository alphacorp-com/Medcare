"use client";

import React from "react";
import { MobileHeader } from "./MobileHeader";
import { MobileBottomNav } from "./MobileBottomNav";

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 pb-[calc(6rem+env(safe-area-inset-bottom))] flex flex-col overflow-x-hidden">
      <MobileHeader />

      {/* Reserves the space of the fixed header (h-16 plus the notch inset). */}
      <div className="h-[calc(4rem+env(safe-area-inset-top))] shrink-0" />

      <main className="flex-1 px-3 pt-3 overflow-y-auto overflow-x-hidden">
        <div className="mx-auto w-full max-w-full min-w-0">
          <div className="w-full max-w-full min-w-0 bg-white rounded-2xl shadow-sm p-3 min-h-[60vh] flex flex-col overflow-hidden">
            {children}
          </div>
        </div>
      </main>

      <MobileBottomNav />
    </div>
  );
}
