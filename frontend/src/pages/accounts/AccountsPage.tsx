import { CircleAlert, Info, Plus, Wallet } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { OpenAccountDialog } from "@/components/accounts/OpenAccountDialog";
import { Sparkline } from "@/components/accounts/Sparkline";
import { TrackAccountDialog } from "@/components/accounts/TrackAccountDialog";
import { Badge, CurrencyTag } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Money } from "@/components/ui/Money";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAccountsOverview } from "@/hooks/useAccountsOverview";
import { ApiError } from "@/services/api/errors";
import { accountLabel, formatDate, formatRelative } from "@/utils/format";

export default function AccountsPage() {
  const { accounts } = useAccountsOverview();
  const [openNew, setOpenNew] = useState(false);
  const [openTrack, setOpenTrack] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <PageHeader
        title="Accounts"
        description="Wallets you hold, with balances straight from the ledger."
        actions={
          <>
            <Button onClick={() => setOpenTrack(true)}>Add existing</Button>
            <Button variant="primary" onClick={() => setOpenNew(true)}>
              <Plus className="size-4" /> Open wallet
            </Button>
          </>
        }
      />

      <Panel className="overflow-hidden">
        {accounts.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No accounts yet"
            actions={
              <>
                <Button variant="primary" onClick={() => setOpenNew(true)}>
                  <Plus className="size-4" /> Open a wallet
                </Button>
                <Button onClick={() => setOpenTrack(true)}>Add existing account</Button>
              </>
            }
          >
            Open a wallet to start receiving and sending money. Already have one? Add it by its account number.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line bg-surface-2 text-2xs font-medium uppercase tracking-[0.06em] text-ink-3">
                  <th scope="col" className="py-2.5 pl-5 pr-3 font-medium">Account</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Type</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Opened</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Last activity</th>
                  <th scope="col" className="px-3 py-2.5 font-medium"><span className="sr-only">Trend</span></th>
                  <th scope="col" className="py-2.5 pl-3 pr-5 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map(({ tracked, kind, statement, isLoading, error }) => {
                  const last = statement?.entries[0];
                  const notFound = error instanceof ApiError && error.status === 404;
                  return (
                    <tr
                      key={tracked.id}
                      tabIndex={0}
                      onClick={() => navigate(`/accounts/${tracked.id}`)}
                      onKeyDown={(e) => e.key === "Enter" && navigate(`/accounts/${tracked.id}`)}
                      className="cursor-pointer border-b border-line transition-colors last:border-b-0 hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
                    >
                      <td className="py-3.5 pl-5 pr-3">
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-[13.5px] font-medium text-ink">{accountLabel(tracked.id)}</span>
                          <CurrencyTag code={tracked.currency} />
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-[13px] text-ink-2">
                        {kind === "system" ? <Badge tone="warning">System</Badge> : kind === "wallet" ? "Wallet" : <span className="text-ink-3">—</span>}
                      </td>
                      <td className="px-3 py-3.5 text-[13px] text-ink-2">
                        {tracked.created_at ? formatDate(tracked.created_at) : <span className="text-ink-3">—</span>}
                      </td>
                      <td className="px-3 py-3.5 text-[13px] text-ink-2">
                        {isLoading ? <Skeleton className="h-3.5 w-20" /> : last ? formatRelative(last.created_at) : <span className="text-ink-3">No entries</span>}
                      </td>
                      <td className="px-3 py-3.5">
                        {statement && <Sparkline balance={statement.account.balance_cached} entries={statement.entries} className="h-7 w-24" />}
                      </td>
                      <td className="py-3.5 pl-3 pr-5 text-right">
                        {isLoading ? (
                          <Skeleton className="ml-auto h-4 w-24" />
                        ) : statement ? (
                          <Money value={statement.account.balance_cached} currency={statement.account.currency} className="text-[14px] font-semibold" />
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[12.5px] text-danger">
                            <CircleAlert className="size-3.5" /> {notFound ? "Not accessible" : "Unavailable"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {accounts.length > 0 && (
        // TODO: Not implemented yet - the backend has no endpoint to list a user's accounts, so this
        // list is the accounts opened or added on this device. Replace with GET /account when it exists.
        <p className="mt-3 flex items-start gap-2 text-[12.5px] text-ink-3">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Showing accounts opened or added on this device. Opened one elsewhere? Use “Add existing”.
        </p>
      )}

      <OpenAccountDialog open={openNew} onOpenChange={setOpenNew} />
      <TrackAccountDialog open={openTrack} onOpenChange={setOpenTrack} />
    </>
  );
}
