import { Scale } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";

/**
 * Reconciliation (auditor only): compares each account's cached balance with the sum of its entries
 * using the `balance_drift` view.
 *
 * TODO: Not implemented yet - POST /api/v1/admin/reconcile is unfinished in the backend
 * (see services/api/admin.ts for details) and the frontend cannot know the user's role because
 * neither the JWT nor any endpoint exposes it. Wire this page to `reconcile()` once both exist,
 * and hide it from customers based on the role the backend returns.
 */
export default function ReconcilePage() {
  return (
    <>
      <PageHeader
        eyebrow={<Badge tone="warning">Not available yet</Badge>}
        title="Reconciliation"
        description="Proves every cached balance equals the sum of its ledger entries."
      />
      <Panel className="overflow-hidden">
        <div className="grid lg:grid-cols-[1fr_1.1fr]">
          <div className="flex flex-col justify-center p-8 sm:p-10">
            <div className="mb-4 grid size-10 place-items-center rounded-lg border border-line bg-surface-2 text-ink-3">
              <Scale className="size-[18px]" strokeWidth={1.75} aria-hidden />
            </div>
            <h2 className="text-[16px] font-semibold text-ink">Reconciliation runs aren't available yet</h2>
            <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-ink-3">
              When enabled, auditors will be able to run a check across all accounts and see any account whose
              stored balance drifts from its entries. Nothing on this page is live.
            </p>
            <div className="mt-6">
              <Button variant="primary" disabled aria-disabled>
                Run reconciliation
              </Button>
            </div>
          </div>
          {/* Layout preview of the future result table; deliberately contains no figures. */}
          <div className="border-t border-line bg-surface-2 p-6 lg:border-l lg:border-t-0" aria-hidden>
            <div className="rounded-lg border border-dashed border-line-strong bg-surface">
              <div className="grid grid-cols-[1fr_1fr_1fr_80px] gap-3 border-b border-line px-4 py-2.5 text-2xs font-medium uppercase tracking-[0.06em] text-ink-3">
                <span>Account</span>
                <span className="text-right">Cached</span>
                <span className="text-right">Derived</span>
                <span className="text-right">Result</span>
              </div>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_1fr_80px] items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
                  <span className="h-2.5 w-14 rounded bg-sunken" />
                  <span className="ml-auto h-2.5 w-16 rounded bg-sunken" />
                  <span className="ml-auto h-2.5 w-16 rounded bg-sunken" />
                  <span className="ml-auto h-4 w-12 rounded bg-sunken" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </Panel>
    </>
  );
}
