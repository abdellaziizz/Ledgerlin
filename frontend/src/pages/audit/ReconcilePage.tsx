import { CircleCheck, CircleAlert, Scale } from "lucide-react";
import { Link } from "react-router";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { Money } from "@/components/ui/Money";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { useAccounts, useReconcile } from "@/hooks/queries";
import { accountLabel, formatDateTime } from "@/utils/format";

/**
 * Reconciliation (auditor only). Calls POST /admin/reconcile, which compares each account's
 * cached balance with the sum of its entries (balance_drift view) and checks every transfer
 * nets to zero. The run is written to the audit log by the backend.
 */
export default function ReconcilePage() {
  const run = useReconcile();
  const accounts = useAccounts();
  const result = run.data;
  const currencyOf = (id: string) => accounts.data?.find((a) => a.id === id)?.currency ?? "";

  return (
    <>
      <PageHeader
        eyebrow={<Badge tone="info">Auditor</Badge>}
        title="Reconciliation"
        description="Proves every cached balance equals the sum of its ledger entries, and every transfer nets to zero."
        actions={
          <Button variant="primary" onClick={() => run.mutate(undefined)} loading={run.isPending}>
            <Scale className="size-4" /> {result ? "Run again" : "Run reconciliation"}
          </Button>
        }
      />

      {run.isError && <ErrorNotice className="mb-5" error={run.error} title="Reconciliation failed to run" />}

      {!result ? (
        <Panel>
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <div className="mb-4 grid size-10 place-items-center rounded-lg border border-line bg-surface-2 text-ink-3">
              <Scale className="size-[18px]" strokeWidth={1.75} aria-hidden />
            </div>
            <h2 className="text-[15px] font-semibold text-ink">No run yet in this session</h2>
            <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-ink-3">
              Balances are cached for fast reads. Reconciliation recomputes each one from its append-only entries; any
              difference means a bug wrote to the cache without posting entries.
            </p>
          </div>
        </Panel>
      ) : (
        <div className="flex flex-col gap-5 animate-rise">
          <Panel>
            <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
              <div className={`grid size-12 shrink-0 place-items-center rounded-full ${result.reconciled ? "bg-accent-soft text-credit" : "bg-danger-soft text-danger"}`}>
                {result.reconciled ? <CircleCheck className="size-6" /> : <CircleAlert className="size-6" />}
              </div>
              <div className="flex-1">
                <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-ink">
                  {result.reconciled ? "Ledger reconciled" : "Drift detected"}
                </h2>
                <p className="text-[13px] text-ink-3">Checked {formatDateTime(result.checked_at)}</p>
              </div>
              <dl className="grid grid-cols-3 gap-6 text-right">
                <div>
                  <dt className="text-2xs text-ink-3">Accounts checked</dt>
                  <dd className="tnum text-[18px] font-semibold text-ink">{result.accounts_checked}</dd>
                </div>
                <div>
                  <dt className="text-2xs text-ink-3">Drifted</dt>
                  <dd className={`tnum text-[18px] font-semibold ${result.drifted_accounts.length ? "text-danger" : "text-ink"}`}>
                    {result.drifted_accounts.length}
                  </dd>
                </div>
                <div>
                  <dt className="text-2xs text-ink-3">Unbalanced transfers</dt>
                  <dd className={`tnum text-[18px] font-semibold ${result.unbalanced_transfers.length ? "text-danger" : "text-ink"}`}>
                    {result.unbalanced_transfers.length}
                  </dd>
                </div>
              </dl>
            </div>
          </Panel>

          {result.drifted_accounts.length > 0 && (
            <Panel className="overflow-hidden">
              <PanelHeader title="Drifted accounts" description="Cached balance differs from the sum of entries" />
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-y border-line bg-surface-2 text-2xs font-medium uppercase tracking-[0.06em] text-ink-3">
                    <th className="py-2.5 pl-5 pr-3 font-medium">Account</th>
                    <th className="px-3 py-2.5 text-right font-medium">Cached</th>
                    <th className="px-3 py-2.5 text-right font-medium">Derived</th>
                    <th className="py-2.5 pl-3 pr-5 text-right font-medium">Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {result.drifted_accounts.map((d) => {
                    const cur = currencyOf(d.account_id);
                    return (
                      <tr key={d.account_id} className="border-b border-line last:border-b-0">
                        <td className="py-3 pl-5 pr-3">
                          <Link to={`/accounts/${d.account_id}`} className="font-mono text-[13px] underline decoration-line-strong underline-offset-4">
                            {accountLabel(d.account_id)}
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-right"><Money value={d.balance_cached} currency={cur} tone="neutral" /></td>
                        <td className="px-3 py-3 text-right"><Money value={d.balance_derived} currency={cur} tone="neutral" /></td>
                        <td className="py-3 pl-3 pr-5 text-right"><Money value={d.difference} currency={cur} signed className="font-semibold" /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Panel>
          )}
          {result.unbalanced_transfers.length > 0 && (
            <ErrorNotice title="Unbalanced transfers">Transfers {result.unbalanced_transfers.map((t) => `#${t}`).join(", ")} don't net to zero.</ErrorNotice>
          )}
        </div>
      )}
    </>
  );
}
