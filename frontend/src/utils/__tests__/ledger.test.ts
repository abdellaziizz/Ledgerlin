import { describe, expect, it } from "vitest";
import type { StatementEntry } from "@/types/api";
import { groupByTransfer, mergeActivity, openingBalance, withRunningBalance } from "../ledger";

const entry = (id: string, transfer: string, signed: number, created = "2026-11-01T10:00:00Z"): StatementEntry => ({
  id,
  transfer_id: transfer,
  direction: signed > 0 ? "credit" : "debit",
  amount_minor: String(Math.abs(signed)),
  signed_amount_minor: String(signed),
  description: null,
  created_at: created,
});

describe("running balance from a newest-first statement", () => {
  const entries = [entry("5", "3", -200), entry("3", "2", 500), entry("1", "1", 1000)];

  it("reconstructs the balance after each entry exactly", () => {
    const rows = withRunningBalance(1300n, entries);
    expect(rows.map((r) => r.balance_after)).toEqual([1300n, 1500n, 1000n]);
  });

  it("derives the opening balance", () => {
    expect(openingBalance(1300n, entries)).toBe(0n);
  });
});

describe("activity", () => {
  it("merges accounts newest first and collapses a transfer between two own accounts", () => {
    const merged = mergeActivity(
      [
        { accountId: "1", currency: "EGP", entries: [entry("2", "1", -100, "2026-11-02T10:00:00Z")] },
        { accountId: "2", currency: "EGP", entries: [entry("3", "1", 100, "2026-11-02T10:00:00Z"), entry("9", "4", 50, "2026-11-03T10:00:00Z")] },
      ],
      10,
    );
    expect(merged.map((m) => m.id)).toEqual(["9", "3", "2"]);
    const groups = groupByTransfer(merged);
    expect(groups.find((g) => g.transfer_id === "1")).toMatchObject({ from: "1", to: "2" });
  });
});
