import { ChevronDown, ScrollText, ShieldOff } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { EntryDetailDialog } from "@/components/statement/EntryDetailDialog";
import { StatementSkeleton, StatementTable } from "@/components/statement/StatementTable";
import { Button, buttonStyles } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { Select } from "@/components/ui/Field";
import { Money } from "@/components/ui/Money";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/Skeleton";
import { useInfiniteStatement } from "@/hooks/queries";
import { useTrackedAccounts } from "@/hooks/useTrackedAccounts";
import { ApiError } from "@/services/api/errors";
import { accountLabel } from "@/utils/format";
import { withRunningBalance, type EntryWithBalance } from "@/utils/ledger";
import { toMinor } from "@/utils/money";

const PAGE_SIZES = ["10", "25", "50", "100"] as const;
type PageSize = (typeof PAGE_SIZES)[number];
type DirectionFilter = "all" | "credit" | "debit";

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 px-5 py-4">
      <div className="text-2xs font-medium text-ink-3">{label}</div>
      <div className="mt-1 text-[16px] font-semibold text-ink">{children}</div>
    </div>
  );
}

export default function StatementPage() {
  const tracked = useTrackedAccounts();
  const [params, setParams] = useSearchParams();
  const requested = params.get("account");
  const accountId = requested && /^[1-9]\d*$/.test(requested) ? requested : tracked[0]?.id;
  const limitParam = params.get("limit") as PageSize | null;
  const limit: PageSize = limitParam && PAGE_SIZES.includes(limitParam) ? limitParam : "25";
  const [direction, setDirection] = useState<DirectionFilter>("all");
  const [selected, setSelected] = useState<EntryWithBalance | null>(null);

  const q = useInfiniteStatement(accountId, Number(limit));
  const data = q.data;
  const header = data?.pages[0]?.account;
  const currency = header?.currency ?? tracked.find((t) => t.id === accountId)?.currency ?? "";

  const all = useMemo(() => {
    const first = data?.pages[0]?.account;
    if (!first) return [];
    return withRunningBalance(toMinor(first.balance_cached), data.pages.flatMap((p) => p.entries));
  }, [data]);

  // TODO: Not implemented yet - the statement endpoint has no direction/date filters,
  // so filtering applies to the entries loaded so far.
  const visible = direction === "all" ? all : all.filter((e) => e.direction === direction);
  const totals = useMemo(() => {
    let inflow = 0n;
    let outflow = 0n;
    for (const e of all) {
      if (e.direction === "credit") inflow += toMinor(e.amount_minor);
      else outflow += toMinor(e.amount_minor);
    }
    return { inflow, outflow };
  }, [all]);

  const complete = !!q.data && !q.hasNextPage;
  const notFound = q.error instanceof ApiError && q.error.status === 404;

  const update = (next: Record<string, string>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) p.set(k, v);
    setParams(p, { replace: true });
  };

  if (!accountId) {
    return (
      <>
        <PageHeader title="Statements" />
        <Panel>
          <EmptyState
            icon={ScrollText}
            title="No accounts to show"
            actions={<Link to="/accounts" className={buttonStyles({ variant: "primary" })}>Go to accounts</Link>}
          >
            Open or add an account to see its statement.
          </EmptyState>
        </Panel>
      </>
    );
  }

  const accountOptions = tracked.some((t) => t.id === accountId)
    ? tracked
    : [{ id: accountId, currency: currency || "…", added_at: "" }, ...tracked];

  return (
    <>
      <PageHeader title="Statement" description="Every entry posted to the account, newest first." />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:w-64">
          <label htmlFor="statement-account" className="sr-only">Account</label>
          <Select id="statement-account" value={accountId} onChange={(e) => update({ account: e.target.value })} className="font-mono">
            {accountOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {accountLabel(a.id)} · {a.currency}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="Direction"
            value={direction}
            onChange={setDirection}
            options={[
              { value: "all", label: "All" },
              { value: "credit", label: "Money in" },
              { value: "debit", label: "Money out" },
            ]}
          />
          <Segmented
            label="Entries per page"
            value={limit}
            onChange={(v) => update({ limit: v })}
            options={PAGE_SIZES.map((s) => ({ value: s, label: s }))}
          />
        </div>
      </div>

      {notFound ? (
        <Panel>
          <EmptyState icon={ShieldOff} title="Statement not available">
            This account doesn't exist or belongs to someone else.
          </EmptyState>
        </Panel>
      ) : (
        <Panel className="overflow-hidden">
          <div className="grid grid-cols-2 divide-line border-b border-line bg-surface-2 sm:grid-cols-4 sm:divide-x">
            <Stat label="Current balance">
              {header ? <Money value={header.balance_cached} currency={currency} /> : <Skeleton className="h-5 w-24" />}
            </Stat>
            <Stat label="Entries loaded">
              {q.data ? <span className="tnum">{all.length}{complete ? "" : "+"}</span> : <Skeleton className="h-5 w-10" />}
            </Stat>
            <Stat label={complete ? "Total in" : "In (loaded)"}>
              {q.data ? <Money value={totals.inflow} currency={currency} tone="neutral" /> : <Skeleton className="h-5 w-20" />}
            </Stat>
            <Stat label={complete ? "Total out" : "Out (loaded)"}>
              {q.data ? <Money value={-totals.outflow} currency={currency} tone="neutral" /> : <Skeleton className="h-5 w-20" />}
            </Stat>
          </div>

          {q.isError && <ErrorNotice className="m-5" error={q.error} title="Couldn't load the statement" onRetry={() => q.refetch()} />}

          {q.isLoading ? (
            <StatementSkeleton rows={8} />
          ) : visible.length ? (
            <StatementTable rows={visible} currency={currency} onSelect={setSelected} />
          ) : q.data ? (
            <EmptyState compact icon={ScrollText} title={all.length ? "No matching entries" : "No entries yet"}>
              {all.length
                ? q.hasNextPage
                  ? "Nothing matches in the loaded entries. Load older entries to search further."
                  : "No entries match this filter."
                : "Transfers to and from this account will be listed here."}
            </EmptyState>
          ) : null}

          {q.data && (
            <div className="flex flex-col items-center gap-2 border-t border-line px-5 py-4">
              {q.hasNextPage ? (
                <Button onClick={() => q.fetchNextPage()} loading={q.isFetchingNextPage} disabled={q.isFetchingNextPage}>
                  {!q.isFetchingNextPage && <ChevronDown className="size-4" />}
                  Load older entries
                </Button>
              ) : all.length > 0 ? (
                <div className="flex w-full items-center justify-between text-[13px]">
                  <span className="text-ink-3">Opening balance</span>
                  <span className="rule-double pb-0.5">
                    <Money value={all[all.length - 1]!.balance_after - toMinor(all[all.length - 1]!.signed_amount_minor)} currency={currency} tone="neutral" />
                  </span>
                </div>
              ) : null}
              {direction !== "all" && q.hasNextPage && (
                <p className="text-2xs text-ink-3">Filters apply to entries loaded so far.</p>
              )}
            </div>
          )}
        </Panel>
      )}

      <EntryDetailDialog entry={selected} accountId={accountId} currency={currency} onClose={() => setSelected(null)} />
    </>
  );
}
