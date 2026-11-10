import { useSession } from "@/contexts/AuthContext";
import type { Account, Statement } from "@/types/api";
import { toMinor } from "@/utils/money";
import { useAccounts, useStatementPages } from "./queries";

export interface AccountOverview {
  account: Account;
  /** Owned by the signed-in user (auditors also see other people's accounts). */
  isOwn: boolean;
  statement?: Statement;
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
}

export const OVERVIEW_PAGE = 20;

/** Every visible account with its live balance and latest entries (first statement page). */
export function useAccountsOverview() {
  const { userId } = useSession();
  const list = useAccounts();
  const all = list.data ?? [];
  const results = useStatementPages(all.map((a) => a.id), OVERVIEW_PAGE);

  const accounts: AccountOverview[] = all.map((account, i) => ({
    account,
    isOwn: account.owner_id === userId,
    statement: results[i]?.data,
    isLoading: results[i]?.isLoading ?? true,
    error: results[i]?.error ?? null,
    refetch: () => void results[i]?.refetch(),
  }));

  // Holdings: the user's own wallets only. System (counterparty) accounts aren't holdings.
  const totals = (() => {
    const map = new Map<string, { minor: bigint; count: number }>();
    for (const a of accounts) {
      if (!a.isOwn || a.account.kind === "system") continue;
      const cur = a.account.currency;
      const balance = a.statement?.account.balance_cached ?? a.account.balance_cached;
      const prev = map.get(cur) ?? { minor: 0n, count: 0 };
      map.set(cur, { minor: prev.minor + toMinor(balance), count: prev.count + 1 });
    }
    return [...map.entries()]
      .map(([currency, v]) => ({ currency, ...v }))
      .sort((a, b) => b.count - a.count || a.currency.localeCompare(b.currency));
  })();

  return {
    accounts,
    totals,
    listError: list.error,
    refetchList: () => void list.refetch(),
    isLoading: list.isLoading || results.some((r) => r.isLoading),
    lastUpdated: Math.max(list.dataUpdatedAt, 0, ...results.map((r) => r.dataUpdatedAt)),
  };
}
