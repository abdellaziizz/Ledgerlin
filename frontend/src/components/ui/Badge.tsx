import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

type Tone = "neutral" | "credit" | "warning" | "danger" | "info" | "outline";
const tones: Record<Tone, string> = {
  neutral: "bg-sunken text-ink-2",
  credit: "bg-accent-soft text-credit",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-ink-2",
  outline: "border border-line-strong text-ink-2",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 whitespace-nowrap rounded px-1.5 text-2xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Monospace currency code chip, e.g. EGP. */
export function CurrencyTag({ code, className }: { code: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded border border-line px-1.5 font-mono text-[10.5px] font-medium tracking-wide text-ink-2",
        className,
      )}
    >
      {code}
    </span>
  );
}
