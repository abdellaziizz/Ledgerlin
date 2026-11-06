import {
  useInfiniteQuery,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useSession } from "@/contexts/AuthContext";
import { accountRegistry } from "@/services/accountRegistry";
import * as accountsApi from "@/services/api/accounts";
import { ApiError } from "@/services/api/errors";
import * as transfersApi from "@/services/api/transfers";
import type { CreateTransferInput } from "@/types/api";

export const queryKeys = {
  statement: (id: string) => ["statement", id] as const,
  statementPage: (id: string, limit: number) => ["statement", id, "page", limit] as const,
  statementInfinite: (id: string, limit: number) => ["statement", id, "infinite", limit] as const,
  account: (id: string) => ["account", id] as const,
};

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

/**
 * Optional account metadata from GET /account/:id.
 * That endpoint currently fails server-side (see services/api/accounts.ts), so this never retries
 * and the UI falls back to the statement header plus what was recorded at account creation.
 */
export function useAccountMeta(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.account(id ?? ""),
    queryFn: ({ signal }) => accountsApi.getAccount(id!, signal),
    enabled: !!id,
    retry: false,
    staleTime: Infinity,
    meta: { silent: true },
  });
}

export function useCreateAccount() {
  const { userId } = useSession();
  return useMutation({
    mutationFn: (currency: string) => accountsApi.createAccount(currency),
    onSuccess: (account) => {
      accountRegistry.upsert(userId, {
        id: account.id,
        currency: account.currency,
        kind: account.kind,
        created_at: account.created_at,
      });
    },
  });
}

/** Verifies access via the statement endpoint (ownership-checked) before tracking an account. */
export function useTrackAccount() {
  const { userId } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const statement = await accountsApi.getStatement(id, { limit: 20 });
      return statement;
    },
    onSuccess: (statement) => {
      qc.setQueryData(queryKeys.statementPage(statement.account.id, 20), statement);
      accountRegistry.upsert(userId, { id: statement.account.id, currency: statement.account.currency });
    },
  });
}

export function useCreateTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ input, key }: { input: CreateTransferInput; key: string }) => transfersApi.createTransfer(input, key),
    onSettled: (_data, _err, { input }) => {
      // Refresh both sides regardless of outcome: an "unknown" outcome may still have committed.
      qc.invalidateQueries({ queryKey: queryKeys.statement(String(input.from_account_id)) });
      qc.invalidateQueries({ queryKey: queryKeys.statement(String(input.to_account_id)) });
    },
  });
}

/** Outcome-unknown errors: the request may or may not have committed; retry with the SAME key. */
export function isRetryableTransferError(err: unknown) {
  if (!(err instanceof ApiError)) return false;
  return err.isNetwork || err.status >= 500 || err.code === "IDEMPOTENCY_IN_PROGRESS";
}
