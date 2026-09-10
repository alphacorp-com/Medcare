"use client";

import React from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default function DesktopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-full h-full overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 bg-slate-100 relative">
        <Header />
        <main className="flex-1 p-4 overflow-auto min-h-0">{children}</main>
      </div>
    </div>
  );
}
