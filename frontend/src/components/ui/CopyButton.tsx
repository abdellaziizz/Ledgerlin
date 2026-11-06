import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { cn } from "@/utils/cn";

export function CopyButton({ value, label = "Copy", className }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={copied ? "Copied" : label}
      title={copied ? "Copied" : label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        } catch {
          /* clipboard unavailable (insecure context); nothing to do */
        }
      }}
      className={cn(
        "inline-grid size-6 place-items-center rounded text-ink-3 transition-colors hover:bg-sunken hover:text-ink",
        className,
      )}
    >
      {copied ? <Check className="size-3.5 text-credit" /> : <Copy className="size-3.5" />}
    </button>
  );
}
