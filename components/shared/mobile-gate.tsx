"use client";

import { useSyncExternalStore } from "react";
import { MonitorSmartphone } from "lucide-react";

interface MobileGateProps {
  children: React.ReactNode;
  title: string;
  description: string;
}

const DESKTOP_QUERY = "(min-width: 768px)";

function subscribe(callback: () => void) {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function getSnapshot() {
  return window.matchMedia(DESKTOP_QUERY).matches;
}

function getServerSnapshot() {
  return true;
}

// Below md (768px) the app isn't usable — tables, sheets, and multi-column layouts
// throughout the product assume at least a tablet-sized viewport. Rather than let a
// phone user hit a broken layout, block entirely and mount `children` only once a
// wide-enough viewport is confirmed.
export function MobileGate({ children, title, description }: MobileGateProps) {
  const isDesktop = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

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
