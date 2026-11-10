import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { CurrencyTag } from "@/components/ui/Badge";
import { Field, Input, Select, Textarea, controlBase } from "@/components/ui/Field";
import { Money } from "@/components/ui/Money";
import { Segmented } from "@/components/ui/Segmented";
import type { AccountOverview } from "@/hooks/useAccountsOverview";
import { cn } from "@/utils/cn";
import { accountLabel } from "@/utils/format";
import { formatMinor, minorDigits, minorToDecimalString, parseAmount, sanitizeAmountInput, toMinor } from "@/utils/money";

export interface TransferDraft {
  fromId: string;
  toId: string;
  /** Exact minor units. */
  amountMinor: bigint;
  currency: string;
  description: string;
  /** Receiver is one of the user's own accounts. */
  toIsOwn: boolean;
}

interface Values {
  from: string;
  toMode: "own" | "number";
  toOwn: string;
  toNumber: string;
  amount: string;
  description: string;
}

const DESCRIPTION_MAX = 500; // schemas/transferSchema.js

export function TransferForm({
  accounts,
  initialFrom,
  initial,
  serverErrors,
  onReview,
}: {
  accounts: AccountOverview[];
  initialFrom?: string;
  /** Restores the form when coming back from review. */
  initial?: TransferDraft | null;
  serverErrors?: Partial<Record<"from" | "to" | "amount" | "description", string>>;
  onReview: (draft: TransferDraft) => void;
}) {
  const usable = accounts.filter((a) => a.statement);
  const defaultFrom = initial?.fromId ?? (usable.some((a) => a.account.id === initialFrom) ? initialFrom! : usable[0]?.account.id ?? "");

  const { register, control, handleSubmit, watch, setValue, setError, clearErrors, formState } = useForm<Values>({
    defaultValues: {
      from: defaultFrom,
      toMode: initial ? (initial.toIsOwn ? "own" : "number") : usable.length > 1 ? "own" : "number",
      toOwn: initial?.toIsOwn ? initial.toId : "",
      toNumber: initial && !initial.toIsOwn ? initial.toId : "",
      amount: initial ? minorToDecimalString(initial.amountMinor, minorDigits(initial.currency)) : "",
      description: initial?.description ?? "",
    },
  });

  const fromId = watch("from");
  const toMode = watch("toMode");
  const description = watch("description");
  const sender = usable.find((a) => a.account.id === fromId);
  const currency = sender?.statement?.account.currency ?? "";
  const balance = sender?.statement ? toMinor(sender.statement.account.balance_cached) : 0n;
  const isSystem = sender?.account.kind === "system";

  const ownTargets = useMemo(() => usable.filter((a) => a.account.id !== fromId), [usable, fromId]);

  useEffect(() => {
    if (!serverErrors) return;
    for (const [k, msg] of Object.entries(serverErrors)) {
      if (!msg) continue;
      const field = k === "to" ? (toMode === "own" ? "toOwn" : "toNumber") : (k as keyof Values);
      setError(field, { message: msg });
    }
  }, [serverErrors, setError, toMode]);

  const onSubmit = handleSubmit((v) => {
    clearErrors();
    let ok = true;
    if (!sender) {
      setError("from", { message: "Choose the account to send from" });
      ok = false;
    }
    const toId = v.toMode === "own" ? v.toOwn : v.toNumber;
    if (!toId) {
      setError(v.toMode === "own" ? "toOwn" : "toNumber", { message: "Choose who receives the money" });
      ok = false;
    } else if (!/^[1-9]\d*$/.test(toId) || !Number.isSafeInteger(Number(toId))) {
      setError("toNumber", { message: "Enter a valid account number" });
      ok = false;
    } else if (toId === v.from) {
      setError(v.toMode === "own" ? "toOwn" : "toNumber", { message: "Choose a different account than the sender" });
      ok = false;
    } else if (v.toMode === "own") {
      const target = usable.find((a) => a.account.id === toId);
      if (target && target.statement?.account.currency !== currency) {
        setError("toOwn", { message: `This account holds ${target.statement?.account.currency}; the sender holds ${currency}` });
        ok = false;
      }
    }
    if (!currency) return;
    const parsed = parseAmount(v.amount, currency);
    if (!parsed.ok) {
      setError("amount", { message: parsed.error });
      ok = false;
    } else if (!isSystem && parsed.minor > balance) {
      setError("amount", { message: `Exceeds the available ${formatMinor(balance, currency)} ${currency}` });
      ok = false;
    }
    if (v.description.trim().length > DESCRIPTION_MAX) {
      setError("description", { message: `Keep it under ${DESCRIPTION_MAX} characters` });
      ok = false;
    }
    if (!ok || !parsed.ok) return;
    onReview({
      fromId: v.from,
      toId,
      amountMinor: parsed.minor,
      currency,
      description: v.description.trim(),
      toIsOwn: v.toMode === "own",
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {/* From */}
      <Field label="From" error={formState.errors.from?.message}>
        {(a) => (
          <Select
            {...a}
            {...register("from", {
              onChange: () => {
                setValue("toOwn", "");
                clearErrors(["toOwn", "amount"]);
              },
            })}
            className="font-mono"
          >
            {usable.map((acc) => (
              <option key={acc.account.id} value={acc.account.id}>
                {accountLabel(acc.account.id)} · {acc.statement!.account.currency} {formatMinor(acc.statement!.account.balance_cached, acc.statement!.account.currency)}
              </option>
            ))}
          </Select>
        )}
      </Field>

      {/* To */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] font-medium text-ink">To</span>
          <Controller
            control={control}
            name="toMode"
            render={({ field }) => (
              <Segmented
                label="Recipient type"
                value={field.value}
                onChange={(v) => {
                  field.onChange(v);
                  clearErrors(["toOwn", "toNumber"]);
                }}
                options={[
                  { value: "own", label: "My accounts" },
                  { value: "number", label: "Account number" },
                ]}
              />
            )}
          />
        </div>
        {toMode === "own" ? (
          <Field label={<span className="sr-only">Receiving account</span>} error={formState.errors.toOwn?.message}>
            {(a) =>
              ownTargets.length ? (
                <Select {...a} {...register("toOwn")} className="font-mono">
                  <option value="">Select an account</option>
                  {ownTargets.map((acc) => {
                    const cur = acc.statement!.account.currency;
                    return (
                      <option key={acc.account.id} value={acc.account.id} disabled={cur !== currency}>
                        {accountLabel(acc.account.id)} · {cur}
                        {cur !== currency ? " (different currency)" : ""}
                      </option>
                    );
                  })}
                </Select>
              ) : (
                <div className={cn(controlBase, "flex h-10 items-center px-3 text-[13px] text-ink-3")}>
                  You have no other accounts. Use an account number instead.
                </div>
              )
            }
          </Field>
        ) : (
          <Field
            label={<span className="sr-only">Receiving account number</span>}
            error={formState.errors.toNumber?.message}
            hint="The recipient's account must hold the same currency."
          >
            {(a) => (
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-ink-3">#</span>
                <Input
                  {...a}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="Account number"
                  className="pl-7 font-mono tnum"
                  {...register("toNumber", {
                    onChange: (e) => setValue("toNumber", e.target.value.replace(/\D/g, "").replace(/^0+/, "")),
                  })}
                />
              </div>
            )}
          </Field>
        )}
      </div>

      {/* Amount */}
      <Field
        label="Amount"
        error={formState.errors.amount?.message}
        trailing={
          sender && (
            <span className="text-2xs text-ink-3">
              {isSystem ? "System account · may go negative" : (
                <>
                  Available <Money value={balance} currency={currency} codePosition="none" className="font-medium text-ink-2" />
                </>
              )}
            </span>
          )
        }
      >
        {(a) => (
          <div className="relative">
            <Input
              {...a}
              inputMode="decimal"
              autoComplete="off"
              placeholder={currency ? minorToDecimalString(0n, minorDigits(currency)) : "0.00"}
              className="h-14 pl-4 pr-28 text-[22px] font-semibold tracking-[-0.01em] tnum"
              {...register("amount", {
                onChange: (e) => setValue("amount", sanitizeAmountInput(e.target.value, currency || "EGP")),
              })}
            />
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-2">
              {!isSystem && balance > 0n && (
                <button
                  type="button"
                  onClick={() => {
                    setValue("amount", minorToDecimalString(balance, minorDigits(currency)));
                    clearErrors("amount");
                  }}
                  className="rounded px-1.5 py-0.5 text-2xs font-medium text-ink-3 hover:bg-sunken hover:text-ink"
                >
                  Max
                </button>
              )}
              {currency && <CurrencyTag code={currency} className="h-6 px-2 text-[11px]" />}
            </div>
          </div>
        )}
      </Field>

      <Field
        label="Description"
        error={formState.errors.description?.message}
        trailing={<span className={cn("tnum text-2xs", description.length > DESCRIPTION_MAX ? "text-danger" : "text-ink-3")}>{description.length}/{DESCRIPTION_MAX}</span>}
        hint="Optional. Shown on both statements."
      >
        {(a) => <Textarea {...a} rows={2} placeholder="e.g. Rent for November" {...register("description")} />}
      </Field>

      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={!sender}>
        Review transfer
      </Button>
    </form>
  );
}
