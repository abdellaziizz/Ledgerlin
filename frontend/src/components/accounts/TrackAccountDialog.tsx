import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input } from "@/components/ui/Field";
import { useTrackAccount } from "@/hooks/queries";
import { ApiError, errorMessage } from "@/services/api/errors";
import { accountLabel } from "@/utils/format";

/**
 * Adds an existing account by number. Access is verified by the backend (statement endpoint,
 * 404 for accounts the user doesn't own) before anything is remembered.
 * TODO: Not implemented yet - remove once the backend can list the user's accounts.
 */
export function TrackAccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [value, setValue] = useState("");
  const track = useTrackAccount();
  const valid = /^[1-9]\d{0,15}$/.test(value);

  const close = (o: boolean) => {
    if (track.isPending) return;
    onOpenChange(o);
    if (!o) {
      setValue("");
      track.reset();
    }
  };

  const submit = () => {
    if (!valid || track.isPending) return;
    track.mutate(value, {
      onSuccess: (s) => {
        toast.success(`Account ${accountLabel(s.account.id)} added`, { description: s.account.currency });
        close(false);
      },
    });
  };

  const error =
    track.error instanceof ApiError && track.error.status === 404
      ? "No account with that number is available to you."
      : track.error
        ? errorMessage(track.error)
        : undefined;

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      dismissible={!track.isPending}
      title="Add an existing account"
      description="For accounts you opened on another device. Only accounts you own can be added."
      footer={
        <>
          <Button variant="ghost" onClick={() => close(false)} disabled={track.isPending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!valid} loading={track.isPending}>
            Verify and add
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label="Account number" error={error}>
          {(a) => (
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-ink-3">#</span>
              <Input
                {...a}
                autoFocus
                inputMode="numeric"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value.replace(/\D/g, "").replace(/^0+/, ""));
                  if (track.isError) track.reset();
                }}
                className="pl-7 font-mono tnum"
                placeholder="1042"
              />
            </div>
          )}
        </Field>
      </form>
    </Dialog>
  );
}
