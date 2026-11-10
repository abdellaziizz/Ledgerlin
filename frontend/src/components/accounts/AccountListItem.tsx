import { ChevronRight, CircleAlert } from "lucide-react";
import { Link } from "react-router";
import { Badge, CurrencyTag } from "@/components/ui/Badge";
import { Money } from "@/components/ui/Money";
import { Skeleton } from "@/components/ui/Skeleton";
import type { AccountOverview } from "@/hooks/useAccountsOverview";
import { accountLabel } from "@/utils/format";
import { Sparkline } from "./Sparkline";

export function AccountListItem({ account: item, showSparkline = true }: { account: AccountOverview; showSparkline?: boolean }) {
  const { account, statement, isLoading, isOwn } = item;
  const balance = statement?.account.balance_cached ?? account.balance_cached;

  return (
    <Link to={`/accounts/${account.id}`} className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-surface-2">
      <div className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 font-mono text-[11px] font-semibold text-ink-2">
        {account.currency}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[13px] font-medium text-ink">{accountLabel(account.id)}</span>
          {account.kind === "system" && <Badge tone="warning">System</Badge>}
          {!isOwn && <Badge tone="outline">Other owner</Badge>}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-2xs text-ink-3">
          <CurrencyTag code={account.currency} className="h-4 px-1 text-[10px]" />
          {account.kind === "system" ? "Counterparty" : "Wallet"}
        </div>
      </div>
      {showSparkline && statement && (
        <Sparkline balance={statement.account.balance_cached} entries={statement.entries} className="hidden h-7 w-24 sm:block" />
      )}
      <div className="text-right">
        {isLoading && !balance ? (
          <Skeleton className="h-4 w-24" />
        ) : balance !== undefined ? (
          <Money value={balance} currency={account.currency} className="text-[14px] font-semibold" />
        ) : (
          <span className="inline-flex items-center gap-1 text-[12.5px] text-danger">
            <CircleAlert className="size-3.5" /> Unavailable
          </span>
        )}
      </div>
      <ChevronRight className="size-4 shrink-0 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
    </Link>
  );
}
