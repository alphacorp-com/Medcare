"use client";

import React, { useSyncExternalStore } from "react";
import DesktopLayout from "./desktop/DesktopLayout";
import MobileLayout from "./mobile/MobileLayout";
import { useIsMobile } from "@/hooks/use-mobile";

const noopSubscribe = () => () => {};

export default function ResponsiveShell({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  // false while server-rendering and hydrating, true once on the client: the layout depends
  // on the viewport, so it is only rendered client-side to avoid a hydration mismatch.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);

  if (!mounted) return null;

  return isMobile ? <MobileLayout>{children}</MobileLayout> : <DesktopLayout>{children}</DesktopLayout>;
}
