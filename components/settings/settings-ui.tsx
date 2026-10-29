"use client";

import { useTranslations } from "next-intl";
import { ArrowLeft, ChevronRight, Loader2, type LucideIcon } from "lucide-react";
import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";

// Responsive building blocks shared by the settings pages. Every component switches between
// "cards" (narrow) and "rows" (wide) from the width of its *container* — the settings content
// area, declared `@container` by settings/layout.tsx and by the mobile branches — rather than
// from the viewport, because the application menu and the settings navigation take a variable
// share of the screen. 42rem (`@2xl`) is the threshold: a tablet in portrait gets touch-sized
// cards, a laptop gets compact rows, from a single markup and without a JS branch.

// Page-level action buttons stretch to full-width, touch-sized buttons on mobile.
export const settingsActionButtonClass = "@max-2xl:h-10 @max-2xl:w-full @max-2xl:rounded-xl";

export function SettingsPageHeader({
  title,
  description,
  actions,
  as: Heading = "h1",
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  as?: "h1" | "h2";
}) {
  return (
    <div className="flex flex-col gap-3 @2xl:flex-row @2xl:items-start @2xl:justify-between">
      <div className="min-w-0">
        <Heading className="text-lg font-bold text-slate-800">{title}</Heading>
        {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
      </div>
      {actions && <div className="grid grid-cols-1 gap-2 @2xl:flex @2xl:shrink-0">{actions}</div>}
    </div>
  );
}

export function SettingsList({
  toolbar,
  isLoading = false,
  isEmpty = false,
  emptyLabel,
  footer,
  children,
}: {
  toolbar?: React.ReactNode;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyLabel?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="@2xl:overflow-hidden @2xl:rounded @2xl:border @2xl:border-slate-200 @2xl:bg-white @2xl:shadow-sm">
      {toolbar && <div className="mb-3 @2xl:mb-0 @2xl:border-b @2xl:border-slate-200 @2xl:bg-slate-50 @2xl:p-2">{toolbar}</div>}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : isEmpty ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-xs text-slate-500 @2xl:rounded-none @2xl:border-0 @2xl:bg-transparent @2xl:py-10 @2xl:italic @2xl:text-slate-400">
          {emptyLabel}
        </div>
      ) : (
        <div className="space-y-3 @2xl:space-y-0 @2xl:divide-y @2xl:divide-slate-100">{children}</div>
      )}
      {footer}
    </div>
  );
}

export type SettingsListAction = {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
};

export function SettingsListItem({
  leading,
  title,
  meta,
  badges,
  active,
  actions = [],
}: {
  leading?: React.ReactNode;
  title: React.ReactNode;
  meta?: React.ReactNode;
  badges?: React.ReactNode;
  active?: { value: boolean; onToggle: () => void };
  actions?: SettingsListAction[];
}) {
  const tc = useTranslations("common");
  // Two labelled buttons fit a phone-width card; beyond that, fall back to icon-only buttons.
  const compactActions = actions.length > 2;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm @2xl:flex-row @2xl:items-center @2xl:justify-between @2xl:gap-4 @2xl:rounded-none @2xl:border-0 @2xl:px-4 @2xl:py-3 @2xl:shadow-none">
      <div className="flex min-w-0 items-start gap-3 @2xl:items-center">
        {leading}
        <div className="min-w-0 flex-1">
          <div className="break-words text-sm font-semibold text-slate-900 @2xl:text-xs @2xl:text-slate-800">{title}</div>
          {meta && (
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500 @2xl:mt-0.5 @2xl:text-[10px] @2xl:text-slate-400">
              {meta}
            </div>
          )}
        </div>
      </div>

      {(badges || active || actions.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 @2xl:shrink-0 @2xl:flex-nowrap @2xl:gap-3 @2xl:border-0 @2xl:pt-0">
          {badges}
          {active && (
            <button
              type="button"
              onClick={active.onToggle}
              className={cn(
                "rounded px-2 py-0.5 text-[10px] font-bold uppercase @max-2xl:rounded-full @max-2xl:px-2.5 @max-2xl:py-1",
                active.value ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
              )}
            >
              {active.value ? tc("active") : tc("inactive")}
            </button>
          )}
          {actions.length > 0 && (
            <div className="ml-auto flex items-center gap-2 @2xl:ml-0 @2xl:gap-3">
              {actions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  title={action.label}
                  aria-label={action.label}
                  onClick={action.onClick}
                  disabled={action.disabled}
                  className={cn(
                    "inline-flex items-center justify-center gap-1.5 text-slate-600 transition-colors disabled:opacity-50 @2xl:text-slate-400",
                    "@max-2xl:h-9 @max-2xl:rounded-xl @max-2xl:border @max-2xl:border-slate-200 @max-2xl:text-xs @max-2xl:font-medium",
                    compactActions ? "@max-2xl:w-9" : "@max-2xl:px-3",
                    action.tone === "danger" ? "hover:text-red-600" : "hover:text-blue-600"
                  )}
                >
                  <action.icon className="h-3.5 w-3.5" />
                  <span className={compactActions ? "sr-only" : "@2xl:sr-only"}>{action.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Small inline code chip (e.g. a catalog code) used in list metadata.
export function SettingsCode({ children }: { children: React.ReactNode }) {
  return <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">{children}</span>;
}

const PILL_TONES = {
  green: "bg-green-100 text-green-800",
  slate: "bg-slate-100 text-slate-700",
  blue: "bg-blue-100 text-blue-800",
  emerald: "bg-emerald-100 text-emerald-800",
} as const;

export function SettingsPill({ tone = "slate", children }: { tone?: keyof typeof PILL_TONES; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium", PILL_TONES[tone])}>
      {children}
    </span>
  );
}

// Coloured square identifying a catalog entry, optionally with its icon.
export function SettingsSwatch({ color, icon: Icon }: { color?: string | null; icon?: React.ComponentType<{ className?: string }> | null }) {
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white @2xl:h-6 @2xl:w-6 @2xl:rounded"
      style={{ backgroundColor: color || "#64748b" }}
    >
      {Icon && <Icon className="h-4 w-4 @2xl:h-3.5 @2xl:w-3.5" />}
    </span>
  );
}

export function SettingsMobileBackButton({ label, href, onClick }: { label: string; href?: string; onClick?: () => void }) {
  const className =
    "inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50";
  const content = (
    <>
      <ArrowLeft className="h-4 w-4" />
      {label}
    </>
  );

  return href ? (
    <Link href={href} className={className}>{content}</Link>
  ) : (
    <button type="button" onClick={onClick} className={className}>{content}</button>
  );
}

export type SettingsMenuEntry = {
  key: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  onSelect?: () => void;
};

export function SettingsMobileMenu({ sections }: { sections: { label: string; entries: SettingsMenuEntry[] }[] }) {
  const rowClass = "flex w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-slate-50 active:bg-slate-100";

  return (
    <div className="space-y-5">
      {sections.filter((section) => section.entries.length > 0).map((section) => (
        <section key={section.label}>
          <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{section.label}</h2>
          <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {section.entries.map((entry) => {
              const content = (
                <>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <entry.icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{entry.label}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                </>
              );
              return entry.href ? (
                <Link key={entry.key} href={entry.href} className={rowClass}>{content}</Link>
              ) : (
                <button key={entry.key} type="button" onClick={entry.onSelect} className={rowClass}>{content}</button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
