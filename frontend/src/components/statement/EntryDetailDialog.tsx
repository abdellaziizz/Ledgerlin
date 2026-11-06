import * as RD from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Badge } from "@/components/ui/Badge";
import { CopyButton } from "@/components/ui/CopyButton";
import { Money } from "@/components/ui/Money";
import { accountLabel, formatDateTime } from "@/utils/format";
import type { EntryWithBalance } from "@/utils/ledger";
import { DirectionIcon } from "./DirectionIcon";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] items-center gap-3 py-2.5">
      <dt className="text-[12.5px] text-ink-3">{label}</dt>
      <dd className="min-w-0 text-[13px] text-ink">{children}</dd>
    </div>
  );
}

/** Side sheet with everything the statement returns for one entry. */
export function EntryDetailDialog({
  entry,
  accountId,
  currency,
  onClose,
}: {
  entry: EntryWithBalance | null;
  accountId: string;
  currency: string;
  onClose: () => void;
}) {
  return (
    <RD.Root open={!!entry} onOpenChange={(o) => !o && onClose()}>
      <RD.Portal>
        <RD.Overlay className="fixed inset-0 z-50 bg-[#05080f]/40 animate-fade-in" />
        <RD.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[420px] flex-col border-l border-line bg-surface shadow-modal animate-slide-in focus:outline-none">
          {entry && (
            <>
              <div className="flex items-center justify-between border-b border-line px-5 py-4">
                <RD.Title className="text-[14px] font-semibold text-ink">Entry #{entry.id}</RD.Title>
                <RD.Description className="sr-only">Ledger entry details</RD.Description>
                <RD.Close className="grid size-8 place-items-center rounded-md text-ink-3 hover:bg-sunken hover:text-ink" aria-label="Close">
                  <X className="size-4" />
                </RD.Close>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-6">
                <div className="flex items-center gap-3">
                  <DirectionIcon direction={entry.direction} className="size-10" />
                  <div>
                    <div className="text-[13px] text-ink-3">{entry.direction === "credit" ? "Received" : "Sent"}</div>
                    <Money value={entry.signed_amount_minor} currency={currency} signed tabular={false} className="text-[26px] font-semibold tracking-[-0.02em]" />
                  </div>
                </div>
                <p className="mt-4 text-[14px] text-ink">{entry.description || <span className="text-ink-3">No description</span>}</p>

                <dl className="mt-6 divide-y divide-line border-y border-line">
                  <Row label="Direction">
                    <Badge tone={entry.direction === "credit" ? "credit" : "neutral"}>
                      {entry.direction === "credit" ? "Credit · money in" : "Debit · money out"}
                    </Badge>
                  </Row>
                  <Row label="Posted">{formatDateTime(entry.created_at)}</Row>
                  <Row label="Account">
                    <Link to={`/accounts/${accountId}`} className="font-mono underline decoration-line-strong underline-offset-4 hover:decoration-ink">
                      {accountLabel(accountId)}
                    </Link>
                  </Row>
                  <Row label="Balance after">
                    <Money value={entry.balance_after} currency={currency} />
                  </Row>
                  <Row label="Transfer">
                    <span className="inline-flex items-center gap-1 font-mono">
                      #{entry.transfer_id}
                      <CopyButton value={entry.transfer_id} label="Copy transfer id" />
                    </span>
                  </Row>
                  <Row label="Entry">
                    <span className="inline-flex items-center gap-1 font-mono">
                      #{entry.id}
                      <CopyButton value={entry.id} label="Copy entry id" />
                    </span>
                  </Row>
                  <Row label="Status">
                    <Badge tone="credit">Posted</Badge>
                  </Row>
                </dl>
                <p className="mt-4 text-[12.5px] leading-relaxed text-ink-3">
                  Ledger entries are append-only. Each transfer posts a matching entry on the other account so the
                  pair always nets to zero.
                </p>
                {/* TODO: Not implemented yet - no GET /transfer/:id endpoint, so the counterparty account isn't shown. */}
              </div>
            </>
          )}
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
