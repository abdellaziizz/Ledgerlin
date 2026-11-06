import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import type { Direction } from "@/types/api";
import { cn } from "@/utils/cn";

export function DirectionIcon({ direction, className }: { direction: Direction; className?: string }) {
  const credit = direction === "credit";
  const Icon = credit ? ArrowDownLeft : ArrowUpRight;
  return (
    <span
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-full border",
        credit ? "border-transparent bg-accent-soft text-credit" : "border-line bg-surface-2 text-ink-2",
        className,
      )}
      aria-label={credit ? "Money in" : "Money out"}
      role="img"
    >
      <Icon className="size-4" strokeWidth={2} aria-hidden />
    </span>
  );
}
