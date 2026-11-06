import type { AccountKind } from "@/types/api";

/**
 * Tracked accounts.
 *
 * TODO: Not implemented yet - the backend has no "list my accounts" endpoint. Until it does,
 * the frontend remembers which account ids this user opened (or added by number) on this
 * device. Only ids and immutable facts from the backend's own POST /account response are
 * stored; balances and activity are always fetched live, and the backend's ownership check
 * (404 for other users' accounts) decides what can actually be viewed.
 */

export interface TrackedAccount {
  id: string;
  currency: string;
  /** Known only for accounts opened from this device (from the POST /account response). */
  kind?: AccountKind;
  created_at?: string;
  added_at: string;
}

const keyFor = (userId: string) => `ledgerline:accounts:${userId}`;
const listeners = new Set<() => void>();
const cache = new Map<string, TrackedAccount[]>();

function read(userId: string): TrackedAccount[] {
  const hit = cache.get(userId);
  if (hit) return hit;
  let list: TrackedAccount[] = [];
  try {
    const raw = localStorage.getItem(keyFor(userId));
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (Array.isArray(parsed)) {
      list = parsed.filter(
        (a): a is TrackedAccount =>
          !!a && typeof a.id === "string" && /^[1-9]\d*$/.test(a.id) && typeof a.currency === "string",
      );
    }
  } catch {
    list = [];
  }
  list.sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
  cache.set(userId, list);
  return list;
}

function write(userId: string, list: TrackedAccount[]) {
  const sorted = [...list].sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
  cache.set(userId, sorted);
  localStorage.setItem(keyFor(userId), JSON.stringify(sorted));
  listeners.forEach((l) => l());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key?.startsWith("ledgerline:accounts:")) {
      cache.clear();
      listeners.forEach((l) => l());
    }
  });
}

export const accountRegistry = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  list: read,
  upsert(userId: string, account: Omit<TrackedAccount, "added_at"> & { added_at?: string }) {
    const list = read(userId);
    const existing = list.find((a) => a.id === account.id);
    const next: TrackedAccount = {
      ...existing,
      ...account,
      added_at: existing?.added_at ?? account.added_at ?? new Date().toISOString(),
    };
    write(userId, [...list.filter((a) => a.id !== account.id), next]);
  },
  remove(userId: string, id: string) {
    write(userId, read(userId).filter((a) => a.id !== id));
  },
  clear(userId: string) {
    write(userId, []);
  },
};
