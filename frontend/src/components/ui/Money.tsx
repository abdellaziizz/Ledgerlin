import { formatMinor, formatMoney, toMinor } from "@/utils/money";
import { cn } from "@/utils/cn";

/**
 * Renders an integer minor-unit amount. The currency code is a quiet mono label, so
 * columns of amounts read as numbers first.
 */
export function Money({
  value,
  currency,
  signed = false,
  tone = "auto",
  codePosition = "after",
  className,
  codeClassName,
  tabular = true,
}: {
  value: string | bigint;
  currency: string;
  signed?: boolean;
  /** auto: credits (positive) in emerald when signed; neutral: always ink. */
  tone?: "auto" | "neutral";
  codePosition?: "before" | "after" | "none";
  className?: string;
  codeClassName?: string;
  tabular?: boolean;
}) {
  const minor = toMinor(value);
  const color = tone === "auto" && signed && minor > 0n ? "text-credit" : "text-ink";
  const code = (
    <span className={cn("font-mono text-[0.72em] font-medium tracking-wide text-ink-3", codeClassName)}>{currency}</span>
  );
  return (
    <span
      className={cn("inline-flex items-baseline gap-1 whitespace-nowrap", tabular && "tnum", color, className)}
      aria-label={formatMoney(minor, currency, { signed })}
    >
      {codePosition === "before" && code}
      <span aria-hidden>{formatMinor(minor, currency, { signed })}</span>
      {codePosition === "after" && code}
    </span>
  );
}
