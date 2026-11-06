import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input } from "@/components/ui/Field";
import { useCreateAccount } from "@/hooks/queries";
import { errorMessage } from "@/services/api/errors";
import { cn } from "@/utils/cn";
import { accountLabel } from "@/utils/format";

const COMMON = ["EGP", "USD", "EUR", "GBP", "SAR", "AED"];

export function OpenAccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [currency, setCurrency] = useState("EGP");
  const [custom, setCustom] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const create = useCreateAccount();
  const navigate = useNavigate();

  const code = (useCustom ? custom : currency).trim().toUpperCase();
  const valid = /^[A-Z]{3}$/.test(code);

  const close = (o: boolean) => {
    if (create.isPending) return;
    onOpenChange(o);
    if (!o) {
      create.reset();
      setUseCustom(false);
      setCustom("");
    }
  };

  const submit = () => {
    if (!valid || create.isPending) return;
    create.mutate(code, {
      onSuccess: (account) => {
        toast.success(`Wallet ${accountLabel(account.id)} opened`, { description: `${account.currency} · balance 0` });
        close(false);
        navigate(`/accounts/${account.id}`);
      },
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      dismissible={!create.isPending}
      title="Open a wallet"
      description="A wallet holds one currency and can't go below zero."
      footer={
        <>
          <Button variant="ghost" onClick={() => close(false)} disabled={create.isPending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!valid} loading={create.isPending}>
            Open {valid ? code : ""} wallet
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col gap-4"
      >
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium text-ink">Currency</legend>
          <div className="grid grid-cols-3 gap-2">
            {COMMON.map((c) => {
              const active = !useCustom && currency === c;
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setUseCustom(false);
                    setCurrency(c);
                  }}
                  className={cn(
                    "h-10 rounded-md border font-mono text-[13px] font-medium tracking-wide transition-colors",
                    active
                      ? "border-accent bg-accent-soft text-ink shadow-[0_0_0_1px_var(--accent)]"
                      : "border-line-strong text-ink-2 hover:border-ink-3/60 hover:text-ink",
                  )}
                >
                  {c}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setUseCustom((v) => !v)}
            className="mt-2.5 text-[12.5px] font-medium text-ink-2 underline decoration-line-strong underline-offset-4 hover:text-ink"
          >
            {useCustom ? "Choose a common currency" : "Use another ISO 4217 code"}
          </button>
        </fieldset>
        {useCustom && (
          <Field label="Currency code" hint="Three letters, for example KWD or JPY." error={custom && !valid ? "Use a three-letter code" : undefined}>
            {(a) => (
              <Input
                {...a}
                autoFocus
                maxLength={3}
                value={custom}
                onChange={(e) => setCustom(e.target.value.replace(/[^a-z]/gi, "").toUpperCase())}
                className="font-mono uppercase tracking-widest"
                placeholder="KWD"
              />
            )}
          </Field>
        )}
        {create.isError && <p role="alert" className="text-[13px] text-danger">{errorMessage(create.error)}</p>}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
