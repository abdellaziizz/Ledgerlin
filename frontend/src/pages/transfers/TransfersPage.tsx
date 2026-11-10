import { ArrowLeftRight, ArrowRight, Plus, Wallet } from "lucide-react";
import { useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { OpenAccountDialog } from "@/components/accounts/OpenAccountDialog";
import { StatementSkeleton } from "@/components/statement/StatementTable";
import { TransferForm, type TransferDraft } from "@/components/transfers/TransferForm";
import { TransferReceipt } from "@/components/transfers/TransferReceipt";
import { TransferReview } from "@/components/transfers/TransferReview";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Money } from "@/components/ui/Money";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { isRetryableTransferError, useCreateTransfer } from "@/hooks/queries";
import { useAccountsOverview } from "@/hooks/useAccountsOverview";
import { ApiError, errorMessage } from "@/services/api/errors";
import type { TransferResult } from "@/services/api/transfers";
import { accountLabel, formatRelative } from "@/utils/format";
import { groupByTransfer, mergeActivity } from "@/utils/ledger";
import { formatMoney, toMinor } from "@/utils/money";
import { newIdempotencyKey } from "@/utils/idempotency";

type FieldErrors = Partial<Record<"from" | "to" | "amount" | "description", string>>;

const fingerprint = (d: TransferDraft) => JSON.stringify([d.fromId, d.toId, d.amountMinor.toString(), d.currency, d.description]);

export default function TransfersPage() {
  const { accounts, isLoading } = useAccountsOverview();
  const [params] = useSearchParams();
  const create = useCreateTransfer();

  const [draft, setDraft] = useState<TransferDraft | null>(null); // review dialog open when set
  const [lastDraft, setLastDraft] = useState<TransferDraft | null>(null); // restores the form after "Edit"
  const [attempt, setAttempt] = useState<{ fp: string; key: string; uncertain: boolean } | null>(null);
  const [reviewError, setReviewError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>();
  const [receipt, setReceipt] = useState<{ result: TransferResult; key: string } | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [openNew, setOpenNew] = useState(false);
  const inFlight = useRef(false);

  const sender = accounts.find((a) => a.account.id === draft?.fromId);
  // Only the owner can send from an account (auditors see others' accounts but can't move money).
  const own = accounts.filter((a) => a.isOwn);

  const openReview = (d: TransferDraft) => {
    const fp = fingerprint(d);
    // Same details as an attempt whose outcome is unknown: keep its key so a retry can't double-send.
    if (!attempt || attempt.fp !== fp) setAttempt({ fp, key: newIdempotencyKey(), uncertain: false });
    setFieldErrors(undefined);
    setReviewError(undefined);
    setLastDraft(d);
    setDraft(d);
  };

  const confirm = () => {
    if (!draft || !attempt || inFlight.current) return;
    inFlight.current = true;
    const key = attempt.key;
    create.mutate(
      {
        key,
        input: {
          from_account_id: Number(draft.fromId),
          to_account_id: Number(draft.toId),
          amount_minor: Number(draft.amountMinor), // <= MAX_SAFE_INTEGER, checked in parseAmount
          currency: draft.currency,
          ...(draft.description ? { description: draft.description } : {}),
        },
      },
      {
        onSuccess: (result) => {
          setReceipt({ result, key });
          setDraft(null);
          setLastDraft(null);
          setAttempt(null);
          toast.success("Transfer complete", {
            description: `${formatMoney(result.transfer.amount_minor, result.transfer.currency)} to ${accountLabel(result.transfer.to_account_id)}`,
          });
        },
        onError: (err) => {
          if (isRetryableTransferError(err)) {
            setAttempt((a) => (a ? { ...a, uncertain: true } : a));
            setReviewError(errorMessage(err));
            return;
          }
          const code = err instanceof ApiError ? err.code : undefined;
          if (code === "IDEMPOTENCY_KEY_REUSED") {
            // Shouldn't happen (keys are per-intent), but recover by minting a fresh key and asking again.
            setAttempt({ fp: fingerprint(draft), key: newIdempotencyKey(), uncertain: false });
            setReviewError("Please confirm again.");
            return;
          }
          // Definite rejection: the backend rolled back, so nothing moved. Back to the form.
          setAttempt(null);
          setDraft(null);
          const fe: FieldErrors = {};
          if (code === "INSUFFICIENT_FUNDS") fe.amount = errorMessage(err);
          else if (code === "CURRENCY_MISMATCH") fe.to = errorMessage(err);
          else if (code === "ACCOUNT_NOT_FOUND" || code === "SAME_ACCOUNT") fe.to = errorMessage(err);
          else if (err instanceof ApiError && Object.keys(err.fieldErrors).length) {
            const f = err.fieldErrors;
            if (f.amount_minor) fe.amount = f.amount_minor;
            if (f.to_account_id) fe.to = f.to_account_id;
            if (f.from_account_id) fe.from = f.from_account_id;
            if (f.description) fe.description = f.description;
          }
          if (Object.keys(fe).length === 0) toast.error("Transfer not sent", { description: errorMessage(err) });
          setFieldErrors(fe);
          setFormKey((k) => k + 1);
        },
        onSettled: () => {
          inFlight.current = false;
        },
      },
    );
  };

  const activity = groupByTransfer(
    mergeActivity(
      own
        .filter((a) => a.statement)
        .map((a) => ({ accountId: a.account.id, currency: a.statement!.account.currency, entries: a.statement!.entries })),
      40,
    ),
  ).slice(0, 10);

  const hasUsable = own.some((a) => a.statement);

  return (
    <>
      <PageHeader title="Transfers" description="Move money between accounts that hold the same currency." />

      <div className="grid items-start gap-5 lg:grid-cols-12">
        <Panel className="lg:col-span-7">
          {receipt ? (
            <TransferReceipt
              result={receipt.result}
              idempotencyKey={receipt.key}
              onNew={() => {
                setReceipt(null);
                setFormKey((k) => k + 1);
              }}
            />
          ) : own.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="Open a wallet first"
              actions={
                <Button variant="primary" onClick={() => setOpenNew(true)}>
                  <Plus className="size-4" /> Open a wallet
                </Button>
              }
            >
              You need an account to send money from.
            </EmptyState>
          ) : isLoading && !hasUsable ? (
            <div className="space-y-4 p-6">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-md bg-sunken" />
              ))}
            </div>
          ) : !hasUsable ? (
            <EmptyState icon={Wallet} title="Accounts unavailable">
              Your accounts couldn't be loaded. Check your connection and try again.
            </EmptyState>
          ) : (
            <>
              <PanelHeader title="New transfer" />
              <div className="border-t border-line p-5 sm:p-6">
                <TransferForm
                  key={formKey}
                  accounts={own}
                  initialFrom={params.get("from") ?? undefined}
                  initial={lastDraft}
                  serverErrors={fieldErrors}
                  onReview={openReview}
                />
              </div>
            </>
          )}
        </Panel>

        <Panel className="lg:col-span-5">
          <PanelHeader title="Recent transfers" description="Across your accounts" />
          <div className="border-t border-line">
            {isLoading && activity.length === 0 ? (
              <StatementSkeleton rows={5} />
            ) : activity.length ? (
              <ul className="divide-y divide-line">
                {activity.map((g) => {
                  const outgoing = g.from && !g.to;
                  const internal = g.from && g.to;
                  return (
                    <li key={g.transfer_id} className="flex items-center gap-3 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] font-medium text-ink">
                          {g.description || (internal ? "Between your accounts" : outgoing ? "Sent" : "Received")}
                        </div>
                        <div className="flex items-center gap-1 font-mono text-2xs text-ink-3">
                          <span>{g.from ? accountLabel(g.from) : "Other account"}</span>
                          <ArrowRight className="size-3" aria-label="to" />
                          <span>{g.to ? accountLabel(g.to) : "Other account"}</span>
                          <span className="font-sans">· {formatRelative(g.created_at)}</span>
                        </div>
                      </div>
                      <Money
                        value={internal ? toMinor(g.amount_minor) : outgoing ? -toMinor(g.amount_minor) : toMinor(g.amount_minor)}
                        currency={g.currency}
                        signed={!internal}
                        className="text-[13.5px] font-medium"
                      />
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState compact icon={ArrowLeftRight} title="No transfers yet">
                Completed transfers will appear here.
              </EmptyState>
            )}
          </div>
          {/* History comes from account statements (the ledger has no separate transfer feed),
              merged across your accounts and collapsed to one row per transfer. */}
        </Panel>
      </div>

      <TransferReview
        draft={draft}
        idempotencyKey={attempt?.key ?? ""}
        senderBalance={sender?.statement ? toMinor(sender.statement.account.balance_cached) : 0n}
        senderIsSystem={sender?.account.kind === "system"}
        pending={create.isPending}
        uncertain={!!attempt?.uncertain}
        error={reviewError}
        onConfirm={confirm}
        onCancel={() => {
          if (create.isPending) return;
          setDraft(null);
        }}
      />
      <OpenAccountDialog open={openNew} onOpenChange={setOpenNew} />
    </>
  );
}
