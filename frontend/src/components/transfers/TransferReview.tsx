import { ArrowDown, CircleAlert, KeyRound, RotateCw } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Money } from "@/components/ui/Money";
import { accountLabel } from "@/utils/format";
import type { TransferDraft } from "./TransferForm";

function Party({ label, id, note }: { label: string; id: string; note: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-4 py-3">
      <div>
        <div className="text-2xs font-medium text-ink-3">{label}</div>
        <div className="font-mono text-[14px] font-medium text-ink">{accountLabel(id)}</div>
      </div>
      <div className="text-right text-2xs text-ink-3">{note}</div>
    </div>
  );
}

/**
 * Confirmation step. The dialog cannot be dismissed while the request is in flight, and the
 * confirm button is disabled so a double-click can't send twice (the Idempotency-Key is the
 * server-side guarantee on top of that).
 */
export function TransferReview({
  draft,
  idempotencyKey,
  senderBalance,
  senderIsSystem,
  pending,
  uncertain,
  error,
  onConfirm,
  onCancel,
}: {
  draft: TransferDraft | null;
  idempotencyKey: string;
  senderBalance: bigint;
  senderIsSystem: boolean;
  pending: boolean;
  /** Last attempt's outcome is unknown; confirming retries with the same key. */
  uncertain: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog
      open={!!draft}
      onOpenChange={(o) => !o && onCancel()}
      dismissible={!pending}
      title={uncertain ? "Retry transfer" : "Review transfer"}
      description={uncertain ? "We couldn't confirm the last attempt." : "Check the details. Transfers can't be reversed."}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            {uncertain ? "Back" : "Edit"}
          </Button>
          <Button variant="primary" onClick={onConfirm} loading={pending} className="sm:min-w-[150px]">
            {pending ? "Sending" : uncertain ? (
              <>
                <RotateCw className="size-4" /> Retry safely
              </>
            ) : (
              "Confirm and send"
            )}
          </Button>
        </>
      }
    >
      {draft && (
        <div className="flex flex-col gap-4">
          <div className="text-center">
            <div className="text-2xs font-medium text-ink-3">You're sending</div>
            <Money
              value={draft.amountMinor}
              currency={draft.currency}
              tabular={false}
              className="mt-1 text-[34px] font-semibold tracking-[-0.03em]"
              codeClassName="text-[14px]"
            />
          </div>

          <div className="relative flex flex-col gap-2">
            <Party
              label="From"
              id={draft.fromId}
              note={
                senderIsSystem ? "System account" : (
                  <>
                    After transfer{" "}
                    <Money value={senderBalance - draft.amountMinor} currency={draft.currency} className="font-medium text-ink-2" />
                  </>
                )
              }
            />
            <div className="absolute left-1/2 top-1/2 z-10 grid size-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-line bg-surface text-ink-3">
              <ArrowDown className="size-3.5" aria-hidden />
            </div>
            <Party label="To" id={draft.toId} note={draft.toIsOwn ? "Your account" : `Must hold ${draft.currency}`} />
          </div>

          {draft.description && (
            <div className="rounded-lg border border-line px-4 py-3">
              <div className="text-2xs font-medium text-ink-3">Description</div>
              <p className="mt-0.5 break-words text-[13px] text-ink">{draft.description}</p>
            </div>
          )}

          {uncertain && (
            <div role="status" className="flex gap-3 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3">
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              <p className="text-[13px] text-ink-2">
                {error ?? "The connection dropped before the ledger answered."} Retrying uses the same request key, so if
                the first attempt went through you'll get its result instead of a second charge.
              </p>
            </div>
          )}
          {!uncertain && error && (
            <p role="alert" className="text-[13px] text-danger">{error}</p>
          )}

          <div className="flex items-center gap-2 text-2xs text-ink-3">
            <KeyRound className="size-3.5 shrink-0" aria-hidden />
            <span>Request key</span>
            <code className="truncate font-mono text-ink-2" title={idempotencyKey}>{idempotencyKey}</code>
          </div>
        </div>
      )}
    </Dialog>
  );
}
