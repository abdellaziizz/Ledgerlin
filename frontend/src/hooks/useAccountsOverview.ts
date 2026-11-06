import type { TrackedAccount } from "@/services/accountRegistry";
import type { AccountKind, Statement } from "@/types/api";
import { effectiveKind } from "@/utils/ledger";
import { toMinor } from "@/utils/money";
import { useStatementPages } from "./queries";
import { useTrackedAccounts } from "./useTrackedAccounts";

export interface AccountOverview {
  tracked: TrackedAccount;
  /** Known or inferred kind; undefined when it can't be determined. */
  kind: AccountKind | undefined;
  statement?: Statement;
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
}

export const OVERVIEW_PAGE = 20;

/** Every tracked account with its live balance and latest entries (first statement page). */
export function useAccountsOverview() {
  const tracked = useTrackedAccounts();
  const results = useStatementPages(tracked.map((t) => t.id), OVERVIEW_PAGE);

  const accounts: AccountOverview[] = tracked.map((t, i) => ({
    tracked: t,
    kind: effectiveKind(t.kind, results[i]?.data?.account.balance_cached),
    statement: results[i]?.data,
    isLoading: results[i]?.isLoading ?? true,
    error: results[i]?.error ?? null,
    refetch: () => void results[i]?.refetch(),
  }));

  // Cheap to compute each render: a handful of accounts.
  const totals = (() => {
    const map = new Map<string, { minor: bigint; count: number }>();
    for (const a of accounts) {
      // System (counterparty) accounts aren't holdings; they may be deeply negative.
      if (!a.statement || a.kind === "system") continue;
      const cur = a.statement.account.currency;
      const prev = map.get(cur) ?? { minor: 0n, count: 0 };
      map.set(cur, { minor: prev.minor + toMinor(a.statement.account.balance_cached), count: prev.count + 1 });
    }
    return [...map.entries()]
      .map(([currency, v]) => ({ currency, ...v }))
      .sort((a, b) => b.count - a.count || a.currency.localeCompare(b.currency));
  })();

  return {
    accounts,
    totals,
    isLoading: results.some((r) => r.isLoading),
    allLoaded: results.every((r) => !r.isLoading),
    lastUpdated: Math.max(0, ...results.map((r) => r.dataUpdatedAt)),
  };
}
