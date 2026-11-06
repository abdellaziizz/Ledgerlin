import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { StatementEntry } from "@/types/api";
import { formatDate, formatDateTime, formatTime } from "@/utils/format";
import { openingBalance, withRunningBalance } from "@/utils/ledger";
import { formatMinor, minorToChartNumber, toMinor } from "@/utils/money";

interface Point {
  t: number;
  y: number; // chart geometry only
  minor: string; // exact value for labels
  label: string;
}

/**
 * Balance after each loaded entry, reconstructed from the live balance. Single series:
 * no legend (the panel title names it), step line because balances change discretely.
 */
export function BalanceChart({ balance, currency, entries }: { balance: string; currency: string; entries: StatementEntry[] }) {
  const data = useMemo<Point[]>(() => {
    const current = toMinor(balance);
    const rows = withRunningBalance(current, entries).reverse();
    if (rows.length === 0) return [];
    const open = openingBalance(current, entries);
    const first = new Date(rows[0]!.created_at).getTime();
    const pts: Point[] = [
      { t: first - 1, y: minorToChartNumber(open, currency), minor: open.toString(), label: "Before" },
      ...rows.map((r) => ({
        t: new Date(r.created_at).getTime(),
        y: minorToChartNumber(r.balance_after, currency),
        minor: r.balance_after.toString(),
        label: r.description || `Transfer #${r.transfer_id}`,
      })),
    ];
    return pts;
  }, [balance, currency, entries]);

  const sameDay = data.length > 0 && new Date(data[0]!.t).toDateString() === new Date(data[data.length - 1]!.t).toDateString();

  if (data.length < 3) {
    return (
      <div className="grid h-[220px] place-items-center rounded-lg border border-dashed border-line text-[13px] text-ink-3">
        Balance history appears after a couple of transfers.
      </div>
    );
  }

  return (
    <div className="h-[220px] w-full" role="img" aria-label={`Balance over the last ${data.length - 1} entries`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="balanceWash" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-line)" stopOpacity={0.12} />
              <stop offset="100%" stopColor="var(--chart-line)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeWidth={1} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(t: number) => (sameDay ? formatTime : formatDate)(new Date(t).toISOString())}
            tick={{ fill: "var(--ink-3)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={48}
            tickMargin={8}
          />
          <YAxis
            width={56}
            tick={{ fill: "var(--ink-3)", fontSize: 11, fontFamily: "var(--font-mono)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(v)}
          />
          <Tooltip
            cursor={{ stroke: "var(--ink-3)", strokeWidth: 1 }}
            content={({ active, payload }) => {
              const p = active ? (payload?.[0]?.payload as Point | undefined) : undefined;
              if (!p) return null;
              return (
                <div className="rounded-lg border border-line bg-surface px-3 py-2 shadow-pop">
                  <div className="text-2xs text-ink-3">{p.label === "Before" ? "Opening balance" : formatDateTime(new Date(p.t).toISOString())}</div>
                  <div className="tnum mt-0.5 text-[13px] font-semibold text-ink">
                    {formatMinor(p.minor, currency)} <span className="font-mono text-2xs font-medium text-ink-3">{currency}</span>
                  </div>
                  {p.label !== "Before" && <div className="mt-0.5 max-w-[200px] truncate text-2xs text-ink-2">{p.label}</div>}
                </div>
              );
            }}
          />
          <Area
            type="stepAfter"
            dataKey="y"
            stroke="var(--chart-line)"
            strokeWidth={2}
            fill="url(#balanceWash)"
            isAnimationActive={false}
            activeDot={{ r: 4, fill: "var(--chart-line)", stroke: "var(--surface)", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
