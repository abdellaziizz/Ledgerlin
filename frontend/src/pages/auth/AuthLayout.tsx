import type { ReactNode } from "react";
import { Logo } from "@/components/layout/Logo";

/** Static illustration of how one transfer posts. Not user data. */
function JournalIllustration() {
  const rows = [
    { side: "Debit", acct: "Wallet #1042", amt: "−250.00", tone: "text-sidebar-ink" },
    { side: "Credit", acct: "Wallet #2210", amt: "+250.00", tone: "text-[#3cc493]" },
  ];
  return (
    <figure className="w-full max-w-[380px]">
      <div className="rounded-xl border border-sidebar-line bg-sidebar-2/70 p-5 shadow-[0_30px_80px_-30px_rgb(0_0_0/0.8)]">
        <div className="mb-4 flex items-center justify-between">
          <span className="font-mono text-[11px] tracking-wide text-sidebar-ink-2">TRANSFER · EGP</span>
          <span className="rounded border border-sidebar-line px-1.5 py-0.5 font-mono text-[10px] text-sidebar-ink-2">Example</span>
        </div>
        <div className="divide-y divide-sidebar-line">
          {rows.map((r) => (
            <div key={r.side} className="grid grid-cols-[64px_1fr_auto] items-baseline gap-3 py-2.5 text-[13px]">
              <span className="text-sidebar-ink-2">{r.side}</span>
              <span className="font-mono text-[12px] text-sidebar-ink">{r.acct}</span>
              <span className={`tnum font-mono ${r.tone}`}>{r.amt}</span>
            </div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-[64px_1fr_auto] items-baseline gap-3 border-t-[3px] border-double border-sidebar-line pt-2.5 text-[13px]">
          <span className="text-sidebar-ink-2">Net</span>
          <span />
          <span className="tnum font-mono text-sidebar-ink">0.00</span>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-md bg-sidebar/80 px-3 py-2 font-mono text-[10.5px] text-sidebar-ink-2">
          <span className="size-1.5 rounded-full bg-[#3cc493]" aria-hidden />
          Idempotency-Key: tr_7f3c…a91e
        </div>
      </div>
      <figcaption className="mt-6 space-y-2 text-[13.5px] leading-relaxed text-sidebar-ink-2">
        <p className="text-[15px] font-medium text-sidebar-ink">Every transfer is two entries that sum to zero.</p>
        <p>
          Entries are append-only, balances can't go below zero, and a retried request with the same key is
          replayed — never charged twice.
        </p>
      </figcaption>
    </figure>
  );
}

export function AuthLayout({ title, subtitle, children, footer }: {
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)] xl:grid-cols-[minmax(0,1fr)_minmax(0,600px)]">
      <div className="flex flex-col px-6 py-8 sm:px-10">
        <Logo tone="ink" />
        <div className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-[380px] animate-rise">
            <h1 className="text-[26px] font-semibold tracking-[-0.025em] text-ink">{title}</h1>
            <p className="mt-1.5 text-[14px] text-ink-3">{subtitle}</p>
            <div className="mt-8">{children}</div>
            <div className="mt-8 text-[13.5px] text-ink-3">{footer}</div>
          </div>
        </div>
        <p className="text-2xs text-ink-3">Amounts are stored as exact integer minor units.</p>
      </div>
      <aside className="relative hidden overflow-hidden bg-sidebar lg:flex lg:items-center lg:justify-center lg:p-12">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: "repeating-linear-gradient(to bottom, transparent 0 35px, #8d98ad 35px 36px)",
          }}
        />
        <div className="relative">
          <JournalIllustration />
        </div>
      </aside>
    </div>
  );
}
