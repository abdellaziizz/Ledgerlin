import { Link } from "react-router";
import { Money } from "@/components/ui/Money";
import { accountLabel, formatRelative } from "@/utils/format";
import type { ActivityItem } from "@/utils/ledger";
import { DirectionIcon } from "./DirectionIcon";

/** Compact cross-account activity feed (dashboard). */
export function ActivityList({ items }: { items: ActivityItem[] }) {
  return (
    <ul className="divide-y divide-line">
      {items.map((it) => (
        <li key={`${it.account_id}:${it.id}`}>
          <Link
            to={`/statements?account=${it.account_id}`}
            className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-2"
          >
            <DirectionIcon direction={it.direction} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-medium text-ink">
                {it.description || (it.direction === "credit" ? "Incoming transfer" : "Outgoing transfer")}
              </div>
              <div className="text-2xs text-ink-3">
                <span className="font-mono">{accountLabel(it.account_id)}</span> · {formatRelative(it.created_at)}
              </div>
            </div>
            <Money value={it.signed_amount_minor} currency={it.currency} signed className="text-[13.5px] font-medium" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
