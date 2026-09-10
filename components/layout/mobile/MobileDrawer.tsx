"use client";

import React from "react";

export function MobileDrawer() {
  return (
    <aside className="fixed inset-0 bg-black/40 backdrop-blur-sm">
      <div className="w-64 bg-white h-full shadow">Drawer content</div>
    </aside>
  );
}
