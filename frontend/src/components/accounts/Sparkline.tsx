import type { StatementEntry } from "@/types/api";
import { openingBalance, withRunningBalance } from "@/utils/ledger";
import { toMinor } from "@/utils/money";

/**
 * Tiny step-line of the balance over the loaded entries. Geometry only: values are scaled
 * relative to the min/max BigInt balance, so no money is converted to floats.
 */
export function Sparkline({ balance, entries, className }: { balance: string; entries: StatementEntry[]; className?: string }) {
  const current = toMinor(balance);
  if (entries.length < 2) {
    return <div className={className} aria-hidden><div className="h-full border-b border-dashed border-line" /></div>;
  }
  const rows = withRunningBalance(current, entries).reverse();
  const points = [openingBalance(current, entries), ...rows.map((r) => r.balance_after)];
  let min = points[0]!;
  let max = points[0]!;
  for (const p of points) {
    if (p < min) min = p;
    if (p > max) max = p;
  }
  const range = max - min || 1n;
  const W = 96;
  const H = 28;
  const step = W / (points.length - 1);
  // Scale in BigInt to 1/1000ths of the height, then to pixels.
  const y = (v: bigint) => H - 2 - (Number(((v - min) * 1000n) / range) / 1000) * (H - 4);
  let d = `M0 ${y(points[0]!).toFixed(1)}`;
  points.slice(1).forEach((p, i) => {
    const x = ((i + 1) * step).toFixed(1);
    d += ` H${x} V${y(p).toFixed(1)}`;
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} preserveAspectRatio="none" aria-hidden>
      <path d={d} fill="none" stroke="var(--chart-line)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
