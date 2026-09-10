"use client";

import React from "react";

export function MobileBottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 h-14 bg-white border-t flex items-center justify-around">
      <button>Home</button>
      <button>Patients</button>
      <button>Pharmacy</button>
      <button>Messages</button>
      <button>More</button>
    </nav>
  );
}
