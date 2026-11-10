import type { StatementEntry } from "@/types/api";
import { toMinor, type MinorUnits } from "./money";

export interface EntryWithBalance extends StatementEntry {
  /** Account balance immediately after this entry posted. */
  balance_after: MinorUnits;
}

/**
 * Statements come newest-first together with the current cached balance, so the balance
 * after each entry is exact: balance_after[0] = current, balance_after[i+1] = balance_after[i] - signed[i].
 * Works across keyset pages because pages are loaded contiguously from the newest entry.
 */
export function withRunningBalance(current: MinorUnits, entries: StatementEntry[]): EntryWithBalance[] {
  let running = current;
  return entries.map((e) => {
    const row = { ...e, balance_after: running };
    running -= toMinor(e.signed_amount_minor);
    return row;
  });
}

/** Balance before the oldest of the given (newest-first) entries. */
export function openingBalance(current: MinorUnits, entries: StatementEntry[]): MinorUnits {
  return entries.reduce((b, e) => b - toMinor(e.signed_amount_minor), current);
}

export interface ActivityItem extends StatementEntry {
  account_id: string;
  currency: string;
}

/** Merges first-page entries from several accounts, newest first. */
export function mergeActivity(
  sources: { accountId: string; currency: string; entries: StatementEntry[] }[],
  limit: number,
): ActivityItem[] {
  const all: ActivityItem[] = [];
  for (const s of sources) for (const e of s.entries) all.push({ ...e, account_id: s.accountId, currency: s.currency });
  all.sort((a, b) => {
    const t = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (t !== 0) return t;
    return BigInt(b.id) > BigInt(a.id) ? 1 : -1;
  });
  return all.slice(0, limit);
}

export interface TransferGroup {
  transfer_id: string;
  created_at: string;
  description: string | null;
  currency: string;
  amount_minor: string;
  /** Visible account that was debited, if any. */
  from?: string;
  /** Visible account that was credited, if any. */
  to?: string;
}

/** Collapses activity into one row per transfer; a transfer between two visible accounts shows both sides. */
export function groupByTransfer(items: ActivityItem[]): TransferGroup[] {
  const map = new Map<string, TransferGroup>();
  for (const it of items) {
    const g = map.get(it.transfer_id) ?? {
      transfer_id: it.transfer_id,
      created_at: it.created_at,
      description: it.description,
      currency: it.currency,
      amount_minor: it.amount_minor,
    };
    if (it.direction === "debit") g.from = it.account_id;
    else g.to = it.account_id;
    map.set(it.transfer_id, g);
  }
  return [...map.values()].sort((a, b) => (BigInt(b.transfer_id) > BigInt(a.transfer_id) ? 1 : -1));
}

