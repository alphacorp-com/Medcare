"use client";

import { formatDistanceToNow } from "date-fns";
import { enUS, fr } from "date-fns/locale";
import { useLocale } from "next-intl";

interface LastLoginBadgeProps {
  lastActive?: string | null;
  neverLabel: string;
}

const DATE_FNS_LOCALES = { fr, en: enUS } as const;

export function LastLoginBadge({ lastActive, neverLabel }: LastLoginBadgeProps) {
  const locale = useLocale();
  if (!lastActive) {
    return <span className="text-slate-400">{neverLabel}</span>;
  }
  const dateLocale = DATE_FNS_LOCALES[locale as keyof typeof DATE_FNS_LOCALES] ?? enUS;
  return (
    <time dateTime={lastActive} title={new Date(lastActive).toLocaleString(locale)}>
      {formatDistanceToNow(new Date(lastActive), { addSuffix: true, locale: dateLocale })}
    </time>
  );
}
