import { ArrowLeftRight, ArrowRight, ChevronRight, History, Plus, RefreshCw, Wallet, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { AccountListItem } from "@/components/accounts/AccountListItem";
import { OpenAccountDialog } from "@/components/accounts/OpenAccountDialog";
import { TrackAccountDialog } from "@/components/accounts/TrackAccountDialog";
import { ActivityList } from "@/components/statement/ActivityList";
import { StatementSkeleton } from "@/components/statement/StatementTable";
import { Button, buttonStyles } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAccountsOverview } from "@/hooks/useAccountsOverview";
import { formatTime } from "@/utils/format";
import { mergeActivity } from "@/utils/ledger";
import { formatMinor } from "@/utils/money";

const today = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" }).format(new Date());

function QuickAction({ icon: Icon, title, description, onClick, to }: {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick?: () => void;
  to?: string;
}) {
  const inner = (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-ink-2 transition-colors group-hover:border-accent/40 group-hover:text-credit">
        <Icon className="size-[17px]" strokeWidth={1.75} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-medium text-ink">{title}</span>
        <span className="block text-2xs text-ink-3">{description}</span>
      </span>
      <ChevronRight className="size-4 text-ink-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
    </>
  );
  const cls = "group flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-surface-2";
  return to ? <Link to={to} className={cls}>{inner}</Link> : <button type="button" onClick={onClick} className={cls}>{inner}</button>;
}

export default function DashboardPage() {
  const { accounts, totals, isLoading, lastUpdated } = useAccountsOverview();
  const [openNew, setOpenNew] = useState(false);
  const [openTrack, setOpenTrack] = useState(false);
  const qc = useQueryClient();

  const activity = mergeActivity(
    accounts
      .filter((a) => a.statement)
      .map((a) => ({ accountId: a.tracked.id, currency: a.statement!.account.currency, entries: a.statement!.entries })),
    8,
  );
  const [primary, ...others] = totals;
  const hasAccounts = accounts.length > 0;

  return (
    <>
      <PageHeader
        eyebrow={today}
        title="Overview"
        actions={
          hasAccounts && (
            <>
              <Button onClick={() => setOpenNew(true)}>
                <Plus className="size-4" /> Open wallet
              </Button>
              <Link to="/transfers" className={buttonStyles({ variant: "primary" })}>
                <ArrowLeftRight className="size-4" /> New transfer
              </Link>
            </>
          )
        }
      />

      {!hasAccounts ? (
        <Panel className="overflow-hidden">
          <div className="grid lg:grid-cols-[1.1fr_1fr]">
            <div className="p-8 sm:p-10">
              <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-ink">Open your first wallet</h2>
              <p className="mt-2 max-w-md text-[14px] leading-relaxed text-ink-3">
                A wallet holds a single currency. It starts at zero and receives money as a transfer from another
                account, so balances always trace back to ledger entries.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <Button variant="primary" size="lg" onClick={() => setOpenNew(true)}>
                  <Plus className="size-4" /> Open a wallet
                </Button>
                <Button size="lg" onClick={() => setOpenTrack(true)}>
                  Add existing account
                </Button>
              </div>
            </div>
            <ol className="border-t border-line bg-surface-2 p-8 sm:p-10 lg:border-l lg:border-t-0">
              {[
                ["Open a wallet", "Pick a currency such as EGP or USD."],
                ["Receive money", "Share your account number with whoever is paying you."],
                ["Send a transfer", "Move money between accounts in the same currency. Retries never charge twice."],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-4 pb-6 last:pb-0">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full border border-line-strong bg-surface font-mono text-[11px] text-ink-2">
                    {i + 1}
                  </span>
                  <div>
                    <div className="text-[13.5px] font-medium text-ink">{t}</div>
                    <div className="text-[13px] text-ink-3">{d}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </Panel>
      ) : (
        <div className="grid gap-5 lg:grid-cols-12">
          {/* Holdings */}
          <Panel className="lg:col-span-8">
            <div className="flex h-full flex-col p-6 sm:p-7">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-ink-2">Total balance</span>
                <button
                  type="button"
                  onClick={() => qc.invalidateQueries({ queryKey: ["statement"] })}
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-2xs text-ink-3 transition-colors hover:bg-sunken hover:text-ink"
                >
                  <RefreshCw className={`size-3 ${isLoading ? "animate-spin" : ""}`} aria-hidden />
                  {lastUpdated ? `Updated ${formatTime(new Date(lastUpdated).toISOString())}` : "Refresh"}
                </button>
              </div>
              <div className="mt-4 min-h-[56px]">
                {primary ? (
                  <div className="flex items-baseline gap-2.5">
                    <span className="text-[44px] font-semibold leading-none tracking-[-0.035em] text-ink sm:text-[52px]">
                      {formatMinor(primary.minor, primary.currency)}
                    </span>
                    <span className="font-mono text-[15px] font-medium text-ink-3">{primary.currency}</span>
                  </div>
                ) : isLoading ? (
                  <Skeleton className="h-12 w-64" />
                ) : accounts.some((a) => a.statement) ? (
                  <span className="text-[14px] text-ink-3">No wallet balances to total yet.</span>
                ) : (
                  <span className="text-[14px] text-ink-3">Balances are unavailable right now.</span>
                )}
              </div>
              <div className="mt-auto pt-6">
                <div className="rule-double mb-3" />
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px]">
                  {primary && (
                    <span className="text-ink-3">
                      {primary.count} {primary.currency} {primary.count === 1 ? "wallet" : "wallets"}
                    </span>
                  )}
                  {others.map((t) => (
                    <span key={t.currency} className="inline-flex items-baseline gap-1.5">
                      <span className="tnum font-medium text-ink">{formatMinor(t.minor, t.currency)}</span>
                      <span className="font-mono text-2xs text-ink-3">{t.currency}</span>
                      <span className="text-2xs text-ink-3">· {t.count}</span>
                    </span>
                  ))}
                  <span className="text-2xs text-ink-3 sm:ml-auto">Per currency, never converted. System accounts excluded.</span>
                </div>
              </div>
            </div>
          </Panel>

          {/* Quick actions */}
          <Panel className="lg:col-span-4">
            <PanelHeader title="Quick actions" />
            <div className="divide-y divide-line border-t border-line">
              <QuickAction icon={ArrowLeftRight} title="Send money" description="Transfer between accounts" to="/transfers" />
              <QuickAction icon={Wallet} title="Open a wallet" description="Add a new currency wallet" onClick={() => setOpenNew(true)} />
              <QuickAction icon={Plus} title="Add existing account" description="Track an account by number" onClick={() => setOpenTrack(true)} />
            </div>
          </Panel>

          {/* Activity */}
          <Panel className="lg:col-span-7">
            <PanelHeader
              title="Recent activity"
              description="Latest entries across your accounts"
              actions={
                <Link to="/statements" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-ink-2 hover:text-ink">
                  Statements <ArrowRight className="size-3.5" />
                </Link>
              }
            />
            <div className="border-t border-line">
              {isLoading && activity.length === 0 ? (
                <StatementSkeleton rows={5} />
              ) : activity.length ? (
                <ActivityList items={activity} />
              ) : (
                <EmptyState compact icon={History} title="No activity yet">
                  Transfers into and out of your accounts will appear here.
                </EmptyState>
              )}
            </div>
          </Panel>

          {/* Accounts */}
          <Panel className="lg:col-span-5">
            <PanelHeader
              title="Accounts"
              description={`${accounts.length} on this device`}
              actions={
                <Link to="/accounts" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-ink-2 hover:text-ink">
                  Manage <ArrowRight className="size-3.5" />
                </Link>
              }
            />
            <div className="divide-y divide-line border-t border-line">
              {accounts.slice(0, 6).map((a) => (
                <AccountListItem key={a.tracked.id} account={a} />
              ))}
            </div>
          </Panel>
        </div>
      )}

      <OpenAccountDialog open={openNew} onOpenChange={setOpenNew} />
      <TrackAccountDialog open={openTrack} onOpenChange={setOpenTrack} />
    </>
  );
}
