import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

export function EmptyState({
  icon: Icon,
  title,
  children,
  actions,
  className,
  compact,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center text-center", compact ? "px-6 py-8" : "px-6 py-14", className)}>
      {Icon && (
        <div className="mb-4 grid size-10 place-items-center rounded-lg border border-line bg-surface-2 text-ink-3">
          <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
        </div>
      )}
      <h3 className="text-[14px] font-semibold text-ink">{title}</h3>
      {children && <div className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-ink-3">{children}</div>}
      {actions && <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{actions}</div>}
    </div>
  );
}
