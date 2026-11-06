import { Check, History } from "lucide-react";
import { Link } from "react-router";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonStyles } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { Money } from "@/components/ui/Money";
import type { TransferResult } from "@/services/api/transfers";
import { accountLabel, formatDateTime } from "@/utils/format";

/** Shown only after a 201 from POST /transfer; every value comes from that response. */
export function TransferReceipt({ result, idempotencyKey, onNew }: { result: TransferResult; idempotencyKey: string; onNew: () => void }) {
  const t = result.transfer;
  const rows: [string, React.ReactNode][] = [
    ["From", <span key="from" className="font-mono">{accountLabel(t.from_account_id)}</span>],
    ["To", <span key="to" className="font-mono">{accountLabel(t.to_account_id)}</span>],
    ["Date", formatDateTime(t.created_at)],
    ["Transfer", <span key="transfer" className="inline-flex items-center gap-1 font-mono">#{t.id}<CopyButton value={t.id} label="Copy transfer id" /></span>],
    ["Request key", <code key="key" className="block max-w-[200px] truncate font-mono text-2xs text-ink-2 sm:max-w-[260px]" title={idempotencyKey}>{idempotencyKey}</code>],
  ];
  if (t.description) rows.splice(3, 0, ["Description", <span key="desc" className="break-words">{t.description}</span>]);

  return (
    <div className="animate-rise">
      <div className="flex flex-col items-center px-6 pb-6 pt-8 text-center">
        <div className="grid size-12 place-items-center rounded-full bg-accent-soft text-credit">
          <Check className="size-6" strokeWidth={2.25} aria-hidden />
        </div>
        <h2 className="mt-4 text-[17px] font-semibold tracking-[-0.01em] text-ink">Transfer complete</h2>
        <Money value={t.amount_minor} currency={t.currency} tabular={false} className="mt-2 text-[32px] font-semibold tracking-[-0.03em]" codeClassName="text-[14px]" />
        {result.replayed && (
          <Badge tone="info" className="mt-3">Already processed — showing the original result</Badge>
        )}
      </div>
      <dl className="mx-6 divide-y divide-dashed divide-line border-y border-dashed border-line-strong">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-4 py-2.5 text-[13px]">
            <dt className="text-ink-3">{k}</dt>
            <dd className="text-right text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-col gap-2 p-6 sm:flex-row">
        <Button variant="primary" className="flex-1" onClick={onNew}>New transfer</Button>
        <Link to={`/statements?account=${t.from_account_id}`} className={buttonStyles({ className: "flex-1" })}>
          <History className="size-4" /> View statement
        </Link>
      </div>
    </div>
  );
}
