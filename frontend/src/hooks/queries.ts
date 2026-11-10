import { useInfiniteQuery, useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import * as accountsApi from "@/services/api/accounts";
import * as adminApi from "@/services/api/admin";
import { ApiError } from "@/services/api/errors";
import * as transfersApi from "@/services/api/transfers";
import type { CreateTransferInput } from "@/types/api";

export const queryKeys = {
  accounts: ["accounts"] as const,
  account: (id: string) => ["account", id] as const,
  statement: (id: string) => ["statement", id] as const,
  statementPage: (id: string, limit: number) => ["statement", id, "page", limit] as const,
  statementInfinite: (id: string, limit: number) => ["statement", id, "infinite", limit] as const,
};

/** GET /accounts: own accounts (all accounts for auditors). */
export function useAccounts() {
  return useQuery({
    queryKey: queryKeys.accounts,
    queryFn: ({ signal }) => accountsApi.listAccounts(signal),
  });
}

export function useAccount(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.account(id ?? ""),
    queryFn: ({ signal }) => accountsApi.getAccount(id!, signal),
    enabled: !!id,
  });
}

/** First page of an account's statement; also the source of the live balance. */
export function useStatementPage(id: string | undefined, limit = 20) {
  return useQuery({
    queryKey: queryKeys.statementPage(id ?? "", limit),
    queryFn: ({ signal }) => accountsApi.getStatement(id!, { limit }, signal),
    enabled: !!id,
  });
}

export function useStatementPages(ids: string[], limit = 20) {
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: queryKeys.statementPage(id, limit),
      queryFn: ({ signal }: { signal: AbortSignal }) => accountsApi.getStatement(id, { limit }, signal),
    })),
  });
}

/** Keyset-paginated statement: each page passes the previous page's next_cursor. */
export function useInfiniteStatement(id: string | undefined, limit: number) {
  return useInfiniteQuery({
    queryKey: queryKeys.statementInfinite(id ?? "", limit),
    queryFn: ({ pageParam, signal }) => accountsApi.getStatement(id!, { cursor: pageParam, limit }, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
    enabled: !!id,
  });
}

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (currency: string) => accountsApi.createAccount(currency),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.accounts }),
  });
}

export function useCreateTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ input, key }: { input: CreateTransferInput; key: string }) => transfersApi.createTransfer(input, key),
    onSettled: (_data, _err, { input }) => {
      // Refresh both sides regardless of outcome: an "unknown" outcome may still have committed.
      qc.invalidateQueries({ queryKey: queryKeys.accounts });
      qc.invalidateQueries({ queryKey: queryKeys.statement(String(input.from_account_id)) });
      qc.invalidateQueries({ queryKey: queryKeys.statement(String(input.to_account_id)) });
      qc.invalidateQueries({ queryKey: queryKeys.account(String(input.from_account_id)) });
      qc.invalidateQueries({ queryKey: queryKeys.account(String(input.to_account_id)) });
    },
  });
}

export function useReconcile() {
  return useMutation({ mutationFn: (accountId?: string) => adminApi.reconcile(accountId) });
}

/** Outcome-unknown errors: the request may or may not have committed; retry with the SAME key. */
export function isRetryableTransferError(err: unknown) {
  if (!(err instanceof ApiError)) return false;
  return err.isNetwork || err.status >= 500 || err.code === "IDEMPOTENCY_IN_PROGRESS";
}
