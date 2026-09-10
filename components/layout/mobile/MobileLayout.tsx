"use client";

import React from "react";
import { MobileHeader } from "./MobileHeader";
import { MobileBottomNav } from "./MobileBottomNav";

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white pb-16">
      <MobileHeader />
      <main className="p-4">{children}</main>
      <MobileBottomNav />
    </div>
  );
}
