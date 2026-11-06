import { ArrowLeft, ArrowLeftRight, ArrowRight, History, Plus, ScrollText, ShieldOff, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { BalanceChart } from "@/components/accounts/BalanceChart";
import { EntryDetailDialog } from "@/components/statement/EntryDetailDialog";
import { StatementSkeleton, StatementTable } from "@/components/statement/StatementTable";
import { Badge, CurrencyTag } from "@/components/ui/Badge";
import { Button, buttonStyles } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Skeleton } from "@/components/ui/Skeleton";
import { useSession } from "@/contexts/AuthContext";
import { useAccountMeta, useStatementPage } from "@/hooks/queries";
import { OVERVIEW_PAGE } from "@/hooks/useAccountsOverview";
import { useTrackedAccounts } from "@/hooks/useTrackedAccounts";
import { accountRegistry } from "@/services/accountRegistry";
import { ApiError } from "@/services/api/errors";
import { accountLabel, formatDateTime } from "@/utils/format";
import { effectiveKind, withRunningBalance, type EntryWithBalance } from "@/utils/ledger";
import { formatMinor, toMinor } from "@/utils/money";

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-[12.5px] text-ink-3">{label}</dt>
      <dd className="text-right text-[13px] text-ink">{children}</dd>
    </div>
  );
}

export default function AccountDetailPage() {
  const { id = "" } = useParams();
  const validId = /^[1-9]\d*$/.test(id);
  const { userId } = useSession();
  const tracked = useTrackedAccounts().find((a) => a.id === id);
  const statementQ = useStatementPage(validId ? id : undefined, OVERVIEW_PAGE);
  const meta = useAccountMeta(validId && statementQ.isSuccess ? id : undefined);
  const [selected, setSelected] = useState<EntryWithBalance | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const navigate = useNavigate();

  const notFound = !validId || (statementQ.error instanceof ApiError && statementQ.error.status === 404);

  if (notFound) {
    return (
      <>
        <BackLink />
        <Panel>
          <EmptyState
            icon={ShieldOff}
            title="Account not available"
            actions={
              <>
                {tracked && (
                  <Button
                    onClick={() => {
                      accountRegistry.remove(userId, id);
                      navigate("/accounts");
                    }}
                  >
                    Remove from this device
                  </Button>
                )}
                <Link to="/accounts" className={buttonStyles({ variant: "primary" })}>Back to accounts</Link>
              </>
            }
          >
            This account doesn't exist or belongs to someone else. Only the owner can view an account.
          </EmptyState>
        </Panel>
      </>
    );
  }

  const statement = statementQ.data;
  const currency = statement?.account.currency ?? tracked?.currency ?? "";
  const kind = effectiveKind(meta.data?.kind ?? tracked?.kind, statement?.account.balance_cached);
  const opened = meta.data?.created_at ?? tracked?.created_at;
  const rows = statement ? withRunningBalance(toMinor(statement.account.balance_cached), statement.entries) : [];

  return (
    <>
      <BackLink />
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">
              {kind === "system" ? "System account" : kind === "wallet" ? "Wallet" : "Account"} <span className="font-mono">{accountLabel(id)}</span>
            </h1>
            {currency && <CurrencyTag code={currency} />}
            {kind === "system" && <Badge tone="warning">Can go negative</Badge>}
          </div>
          <p className="mt-1 text-[13.5px] text-ink-3">Opened {opened ? formatDateTime(opened) : "— date not available"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!tracked && statement && (
            <Button
              onClick={() => {
                accountRegistry.upsert(userId, { id, currency: statement.account.currency });
                toast.success(`Account ${accountLabel(id)} added`);
              }}
            >
              <Plus className="size-4" /> Add to my accounts
            </Button>
          )}
          <Link to={`/statements?account=${id}`} className={buttonStyles()}>
            <ScrollText className="size-4" /> Statement
          </Link>
          <Link to={`/transfers?from=${id}`} className={buttonStyles({ variant: "primary" })}>
            <ArrowLeftRight className="size-4" /> Send from this account
          </Link>
        </div>
      </div>

      {statementQ.isError && !notFound && (
        <ErrorNotice className="mb-5" error={statementQ.error} title="Couldn't load this account" onRetry={() => statementQ.refetch()} />
      )}

      <div className="grid gap-5 lg:grid-cols-12">
        <Panel className="lg:col-span-8">
          <div className="px-6 pt-6">
            <div className="text-[13px] font-medium text-ink-2">Available balance</div>
            <div className="mt-2 min-h-[48px]">
              {statement ? (
                <div className="flex items-baseline gap-2">
                  <span className="text-[40px] font-semibold leading-none tracking-[-0.035em] text-ink">
                    {formatMinor(statement.account.balance_cached, currency)}
                  </span>
                  <span className="font-mono text-[14px] font-medium text-ink-3">{currency}</span>
                </div>
              ) : (
                <Skeleton className="h-10 w-56" />
              )}
            </div>
          </div>
          <div className="px-3 pb-4 pt-6 sm:px-4">
            <div className="mb-2 px-2 text-2xs text-ink-3">
              Balance over the last {statement?.entries.length ?? 0} {statement?.entries.length === 1 ? "entry" : "entries"}
            </div>
            {statement ? (
              <BalanceChart balance={statement.account.balance_cached} currency={currency} entries={statement.entries} />
            ) : (
              <Skeleton className="h-[220px] w-full" />
            )}
          </div>
        </Panel>

        <Panel className="lg:col-span-4">
          <PanelHeader title="Details" />
          <dl className="divide-y divide-line border-t border-line px-5">
            <Detail label="Account number">
              <span className="inline-flex items-center gap-1 font-mono">
                {id}
                <CopyButton value={id} label="Copy account number" />
              </span>
            </Detail>
            <Detail label="Currency">{currency || "—"}</Detail>
            <Detail label="Type">{kind === "system" ? "System (counterparty)" : kind === "wallet" ? "Wallet" : "—"}</Detail>
            <Detail label="Overdraft">{kind === "system" ? "Allowed" : kind === "wallet" ? "Not allowed" : "—"}</Detail>
            <Detail label="Owner">You</Detail>
            {/* TODO: Not implemented yet - account status and locking/unlocking don't exist in the backend schema or routes. */}
          </dl>
          {tracked && (
            <div className="border-t border-line px-5 py-4">
              <button
                type="button"
                onClick={() => setConfirmRemove(true)}
                className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-3 hover:text-danger"
              >
                <Trash2 className="size-3.5" /> Remove from this device
              </button>
            </div>
          )}
        </Panel>

        <Panel className="overflow-hidden lg:col-span-12">
          <PanelHeader
            title="Recent entries"
            actions={
              <Link to={`/statements?account=${id}`} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-ink-2 hover:text-ink">
                Full statement <ArrowRight className="size-3.5" />
              </Link>
            }
          />
          <div className="border-t border-line">
            {statementQ.isLoading ? (
              <StatementSkeleton rows={4} />
            ) : rows.length ? (
              <StatementTable rows={rows.slice(0, 8)} currency={currency} onSelect={setSelected} />
            ) : (
              <EmptyState compact icon={History} title="No entries yet">
                Share account number <span className="font-mono text-ink-2">{id}</span> to receive a transfer.
              </EmptyState>
            )}
          </div>
        </Panel>
      </div>

      <EntryDetailDialog entry={selected} accountId={id} currency={currency} onClose={() => setSelected(null)} />
      <Dialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={`Remove ${accountLabel(id)} from this device?`}
        description="The account and its money stay on the ledger. You can add it back any time with its number."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmRemove(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                accountRegistry.remove(userId, id);
                setConfirmRemove(false);
                toast(`Removed ${accountLabel(id)} from this device`);
                navigate("/accounts");
              }}
            >
              Remove
            </Button>
          </>
        }
      />
    </>
  );
}

function BackLink() {
  return (
    <Link to="/accounts" className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-3 hover:text-ink">
      <ArrowLeft className="size-3.5" /> Accounts
    </Link>
  );
}
