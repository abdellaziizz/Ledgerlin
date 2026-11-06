import * as RD from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  dismissible = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** False while a sensitive request is in flight, so it can't be closed mid-submit. */
  dismissible?: boolean;
}) {
  return (
    <RD.Root open={open} onOpenChange={(o) => (dismissible || o) && onOpenChange(o)}>
      <RD.Portal>
        <RD.Overlay className="fixed inset-0 z-50 bg-[#05080f]/45 backdrop-blur-[2px] animate-fade-in" />
        <RD.Content
          onEscapeKeyDown={(e) => !dismissible && e.preventDefault()}
          onPointerDownOutside={(e) => !dismissible && e.preventDefault()}
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2",
            "rounded-xl border border-line bg-surface shadow-modal animate-rise focus:outline-none",
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 px-5 pt-5">
            <div>
              <RD.Title className="text-[15px] font-semibold tracking-[-0.01em] text-ink">{title}</RD.Title>
              {description ? (
                <RD.Description className="mt-1 text-[13px] text-ink-3">{description}</RD.Description>
              ) : (
                <RD.Description className="sr-only">{typeof title === "string" ? title : "Dialog"}</RD.Description>
              )}
            </div>
            {dismissible && (
              <RD.Close className="-mr-1.5 -mt-1 grid size-8 place-items-center rounded-md text-ink-3 hover:bg-sunken hover:text-ink" aria-label="Close">
                <X className="size-4" />
              </RD.Close>
            )}
          </div>
          <div className="px-5 pb-5 pt-4">{children}</div>
          {footer && (
            <div className="flex flex-col-reverse gap-2 rounded-b-xl border-t border-line bg-surface-2 px-5 py-3.5 sm:flex-row sm:justify-end">
              {footer}
            </div>
          )}
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
