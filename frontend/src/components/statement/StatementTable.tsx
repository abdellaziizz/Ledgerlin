import { Fragment } from "react";
import { Money } from "@/components/ui/Money";
import { cn } from "@/utils/cn";
import { formatDay, formatTime } from "@/utils/format";
import type { EntryWithBalance } from "@/utils/ledger";
import { DirectionIcon } from "./DirectionIcon";

/**
 * Ledger-style statement: grouped by day, signed amounts, and the running balance after
 * each entry. Rows open the entry detail sheet.
 */
export function StatementTable({
  rows,
  currency,
  onSelect,
  showBalance = true,
}: {
  rows: EntryWithBalance[];
  currency: string;
  onSelect?: (row: EntryWithBalance) => void;
  showBalance?: boolean;
}) {
  const groups: { day: string; rows: EntryWithBalance[] }[] = [];
  for (const r of rows) {
    const day = formatDay(r.created_at);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.rows.push(r);
    else groups.push({ day, rows: [r] });
  }

  return (
    <table className="w-full border-collapse text-left">
      <thead className="sr-only sm:not-sr-only">
        <tr className="border-b border-line text-2xs font-medium uppercase tracking-[0.06em] text-ink-3">
          <th scope="col" className="py-2 pl-5 pr-3 font-medium">Description</th>
          <th scope="col" className="hidden px-3 py-2 font-medium md:table-cell">Transfer</th>
          <th scope="col" className="px-3 py-2 text-right font-medium">Amount</th>
          {showBalance && <th scope="col" className="hidden py-2 pl-3 pr-5 text-right font-medium sm:table-cell">Balance</th>}
        </tr>
      </thead>
      <tbody>
        {groups.map((g) => (
          <Fragment key={g.day + g.rows[0]!.id}>
            <tr>
              <th colSpan={4} scope="rowgroup" className="bg-surface-2 px-5 py-1.5 text-left text-2xs font-medium text-ink-3">
                {g.day}
              </th>
            </tr>
            {g.rows.map((r) => (
              <tr
                key={r.id}
                tabIndex={onSelect ? 0 : undefined}
                onClick={() => onSelect?.(r)}
                onKeyDown={(e) => {
                  if (onSelect && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    onSelect(r);
                  }
                }}
                className={cn(
                  "border-b border-line last:border-b-0 transition-colors",
                  onSelect && "cursor-pointer hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none",
                )}
              >
                <td className="py-3 pl-5 pr-3">
                  <div className="flex items-center gap-3">
                    <DirectionIcon direction={r.direction} />
                    <div className="min-w-0">
                      <div className="truncate text-[13.5px] font-medium text-ink">
                        {r.description || (r.direction === "credit" ? "Incoming transfer" : "Outgoing transfer")}
                      </div>
                      <div className="text-2xs text-ink-3">
                        {formatTime(r.created_at)}
                        <span className="md:hidden"> · Transfer #{r.transfer_id}</span>
                      </div>
                    </div>
                  </div>
                </td>
                <td className="hidden px-3 py-3 font-mono text-[12px] text-ink-3 md:table-cell">#{r.transfer_id}</td>
                <td className="px-3 py-3 text-right">
                  <Money value={r.signed_amount_minor} currency={currency} signed className="text-[13.5px] font-medium" codePosition="none" />
                </td>
                {showBalance && (
                  <td className="hidden py-3 pl-3 pr-5 text-right sm:table-cell">
                    <Money value={r.balance_after} currency={currency} tone="neutral" codePosition="none" className="text-[13px] text-ink-2" />
                  </td>
                )}
              </tr>
            ))}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}

export function StatementSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="divide-y divide-line">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-3.5">
          <div className="size-8 animate-pulse rounded-full bg-sunken" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-40 animate-pulse rounded bg-sunken" />
            <div className="h-2.5 w-16 animate-pulse rounded bg-sunken" />
          </div>
          <div className="h-3 w-20 animate-pulse rounded bg-sunken" />
        </div>
      ))}
    </div>
  );
}
