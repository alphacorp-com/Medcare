"use client";

import { useEffect, useState } from "react";
import { MonitorSmartphone } from "lucide-react";

interface MobileGateProps {
  children: React.ReactNode;
  title: string;
  description: string;
}

// Below md (768px) the app isn't usable — tables, sheets, and multi-column layouts
// throughout the product assume at least a tablet-sized viewport. Rather than let a
// phone user hit a broken layout, block entirely and mount `children` only once a
// wide-enough viewport is confirmed.
export function MobileGate({ children, title, description }: MobileGateProps) {
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    setIsDesktop(query.matches);
    const handleChange = (event: MediaQueryListEvent) => setIsDesktop(event.matches);
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  if (!isDesktop) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50 p-6">
        <div className="max-w-sm text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-100">
            <MonitorSmartphone className="h-7 w-7 text-blue-600" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">{title}</h1>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
