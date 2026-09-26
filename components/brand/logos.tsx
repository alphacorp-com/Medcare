import Image from "next/image";
import { cn } from "@/lib/utils";

// Brand assets live in /public/brand — cropped (and white-tinted for dark backgrounds)
// from the original /public/logo_medcare.png and /public/LOGO_AlphaCorp.png.

const ALPHACORP_URL = "https://alphacorp.vercel.app";

type Tone = "light" | "dark";

export function MedcareLogo({ tone = "light", compact = false, className }: { tone?: Tone; compact?: boolean; className?: string }) {
  const suffix = tone === "dark" ? "-white" : "";
  return compact ? (
    <Image src={`/brand/medcare-mark${suffix}.png`} alt="MedCare" width={33} height={31} className={cn("h-7 w-auto", className)} />
  ) : (
    <Image src={`/brand/medcare-logo${suffix}.png`} alt="MedCare" width={306} height={75} priority className={cn("h-7 w-auto", className)} />
  );
}

// The AlphaCorp ∞ mark, animated (see `.alphacorp-mark` in globals.css).
export function AlphaCorpMark({ className }: { className?: string }) {
  return (
    <span className={cn("alphacorp-mark h-6 w-12", className)}>
      <Image src="/brand/alphacorp-mark.png" alt="" width={192} height={95} className="h-full w-full object-contain" />
    </span>
  );
}

export function PoweredByAlphaCorp({
  tone = "light",
  compact = false,
  label,
  className,
}: {
  tone?: Tone;
  compact?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <a
      href={ALPHACORP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Alpha Corporation"
      className={cn("group flex items-center gap-2", compact ? "justify-center" : "", className)}
    >
      <AlphaCorpMark className={compact ? "h-6 w-12" : "h-7 w-14 shrink-0"} />
      {!compact && (
        <span className="flex min-w-0 flex-col gap-0.5">
          {label && (
            <span className={cn("text-[10px] leading-none", tone === "dark" ? "text-slate-500" : "text-slate-400")}>{label}</span>
          )}
          <Image
            src={`/brand/alphacorp-wordmark${tone === "dark" ? "-white" : ""}.png`}
            alt="Alpha Corporation"
            width={240}
            height={83}
            className="h-8 w-auto opacity-90 transition-opacity group-hover:opacity-100"
          />
        </span>
      )}
    </a>
  );
}
