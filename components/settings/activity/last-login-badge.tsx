import { formatDistanceToNow } from "date-fns";

interface LastLoginBadgeProps {
  lastActive?: string | null;
  neverLabel: string;
}

export function LastLoginBadge({ lastActive, neverLabel }: LastLoginBadgeProps) {
  if (!lastActive) {
    return <span className="text-slate-400">{neverLabel}</span>;
  }
  return <span>{formatDistanceToNow(new Date(lastActive), { addSuffix: true })}</span>;
}
