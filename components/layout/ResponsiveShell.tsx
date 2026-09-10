"use client";

import React, { useEffect, useState } from "react";
import DesktopLayout from "./desktop/DesktopLayout";
import MobileLayout from "./mobile/MobileLayout";

export default function ResponsiveShell({ children }: { children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    function update() {
      setIsMobile(window.innerWidth < 768);
    }

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  if (isMobile === null) return null;

  return isMobile ? <MobileLayout>{children}</MobileLayout> : <DesktopLayout>{children}</DesktopLayout>;
}
