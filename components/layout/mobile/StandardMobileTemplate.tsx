"use client";

import React from "react";

// Title, subtitle and actions of a mobile screen, above its content. The mobile chrome itself
// (fixed header, bottom navigation, the space they reserve, the content card) is MobileLayout's,
// which wraps every dashboard page: rendering it again here stacked two headers, two spacers
// and two cards.
export default function StandardMobileTemplate({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="mb-3 min-w-0 pt-1 text-center">
        <div className="truncate text-base font-semibold text-slate-900">{title}</div>
        {subtitle && <div className="truncate text-[12px] text-slate-500">{subtitle}</div>}
      </div>

      {actions && <div className="mb-3">{actions}</div>}

      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
