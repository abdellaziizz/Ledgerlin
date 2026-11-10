import { Plus, Wallet } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { OpenAccountDialog } from "@/components/accounts/OpenAccountDialog";
import { Sparkline } from "@/components/accounts/Sparkline";
import { Badge, CurrencyTag } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { Money } from "@/components/ui/Money";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Skeleton } from "@/components/ui/Skeleton";
import { useSession } from "@/contexts/AuthContext";
import { useAccountsOverview } from "@/hooks/useAccountsOverview";
import { accountLabel, formatDate, formatRelative } from "@/utils/format";

export default function AccountsPage() {
  const { accounts, isLoading, listError, refetchList } = useAccountsOverview();
  const { role } = useSession();
  const isAuditor = role === "auditor";
  const [openNew, setOpenNew] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <PageHeader
        title="Accounts"
        description={isAuditor ? "Every account on the ledger (auditor view)." : "Wallets you hold, with balances straight from the ledger."}
        actions={
          <Button variant="primary" onClick={() => setOpenNew(true)}>
            <Plus className="size-4" /> Open wallet
          </Button>
        }
      />

      {listError ? <ErrorNotice className="mb-4" error={listError} title="Couldn't load accounts" onRetry={refetchList} /> : null}

      <Panel className="overflow-hidden">
        {isLoading && accounts.length === 0 ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : accounts.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No accounts yet"
            actions={
              <Button variant="primary" onClick={() => setOpenNew(true)}>
                <Plus className="size-4" /> Open a wallet
              </Button>
            }
          >
            Open a wallet to start receiving and sending money.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line bg-surface-2 text-2xs font-medium uppercase tracking-[0.06em] text-ink-3">
                  <th scope="col" className="py-2.5 pl-5 pr-3 font-medium">Account</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Type</th>
                  {isAuditor && <th scope="col" className="px-3 py-2.5 font-medium">Owner</th>}
                  <th scope="col" className="px-3 py-2.5 font-medium">Opened</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Last activity</th>
                  <th scope="col" className="px-3 py-2.5 font-medium"><span className="sr-only">Trend</span></th>
                  <th scope="col" className="py-2.5 pl-3 pr-5 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map(({ account, statement, isLoading: rowLoading, isOwn }) => {
                  const last = statement?.entries[0];
                  return (
                    <tr
                      key={account.id}
                      tabIndex={0}
                      onClick={() => navigate(`/accounts/${account.id}`)}
                      onKeyDown={(e) => e.key === "Enter" && navigate(`/accounts/${account.id}`)}
                      className="cursor-pointer border-b border-line transition-colors last:border-b-0 hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
                    >
                      <td className="py-3.5 pl-5 pr-3">
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-[13.5px] font-medium text-ink">{accountLabel(account.id)}</span>
                          <CurrencyTag code={account.currency} />
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-[13px] text-ink-2">
                        {account.kind === "system" ? <Badge tone="warning">System</Badge> : "Wallet"}
                      </td>
                      {isAuditor && (
                        <td className="px-3 py-3.5 font-mono text-[12px] text-ink-3" title={account.owner_id}>
                          {isOwn ? "You" : `${account.owner_id.slice(0, 8)}…`}
                        </td>
                      )}
                      <td className="px-3 py-3.5 text-[13px] text-ink-2">{formatDate(account.created_at)}</td>
                      <td className="px-3 py-3.5 text-[13px] text-ink-2">
                        {rowLoading ? <Skeleton className="h-3.5 w-20" /> : last ? formatRelative(last.created_at) : <span className="text-ink-3">No entries</span>}
                      </td>
                      <td className="px-3 py-3.5">
                        {statement && <Sparkline balance={statement.account.balance_cached} entries={statement.entries} className="h-7 w-24" />}
                      </td>
                      <td className="py-3.5 pl-3 pr-5 text-right">
                        <Money value={statement?.account.balance_cached ?? account.balance_cached} currency={account.currency} className="text-[14px] font-semibold" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <OpenAccountDialog open={openNew} onOpenChange={setOpenNew} />
    </>
  );
}
