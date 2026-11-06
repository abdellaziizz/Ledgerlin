import { CircleAlert, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { errorMessage } from "@/services/api/errors";
import { cn } from "@/utils/cn";
import { Button } from "./Button";

export function ErrorNotice({
  error,
  title,
  onRetry,
  className,
  children,
}: {
  error?: unknown;
  title?: ReactNode;
  onRetry?: () => void;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div role="alert" className={cn("flex items-start gap-3 rounded-lg border border-danger/25 bg-danger-soft px-4 py-3", className)}>
      <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className="text-[13px] font-medium text-ink">{title}</p>}
        <p className="text-[13px] text-ink-2">{children ?? errorMessage(error)}</p>
      </div>
      {onRetry && (
        <Button size="sm" variant="ghost" onClick={onRetry} className="-my-1">
          <RefreshCw className="size-3.5" /> Retry
        </Button>
      )}
    </div>
  );
}
