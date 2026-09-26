"use client";

import React, { useEffect, useState } from "react";
import DesktopLayout from "./desktop/DesktopLayout";
import MobileLayout from "./mobile/MobileLayout";
import { useIsMobile } from "@/hooks/use-mobile";

export default function ResponsiveShell({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // avoid hydration mismatch by waiting for client mount
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return isMobile ? <MobileLayout>{children}</MobileLayout> : <DesktopLayout>{children}</DesktopLayout>;
}
