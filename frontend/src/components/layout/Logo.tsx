import { cn } from "@/utils/cn";

/** Two offset bars: a debit and its matching credit. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden>
      <rect width="32" height="32" rx="7" className="fill-sidebar-2" />
      <rect x="7" y="10" width="13" height="3.5" rx="1" fill="#E8ECF2" />
      <rect x="12" y="18.5" width="13" height="3.5" rx="1" fill="#34C08F" />
    </svg>
  );
}

export function Logo({ className, tone = "light" }: { className?: string; tone?: "light" | "ink" }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className={cn("text-[15px] font-semibold tracking-[-0.02em]", tone === "light" ? "text-sidebar-ink" : "text-ink")}>
        Ledgerline
      </span>
    </span>
  );
}
