import { describe, expect, it } from "vitest";
import { createAccountSchema, statementQuerySchema } from "../../schemas/accountSchema.js";
import { registerSchema } from "../../schemas/authSchema.js";
import { transferSchema } from "../../schemas/transferSchema.js";

const transfer = (body) => transferSchema.safeParse({ body });
const base = { from_account_id: 1, to_account_id: 2, amount_minor: 1500, currency: "egp" };

describe("transfer amount and currency rules", () => {
  it("accepts integer minor units and normalises the currency code", () => {
    const r = transfer(base);
    expect(r.success).toBe(true);
    expect(r.data.body.currency).toBe("EGP");
    expect(r.data.body.amount_minor).toBe(1500);
  });

  it.each([
    ["a float amount", { amount_minor: 15.5 }],
    ["a string amount", { amount_minor: "1500" }],
    ["zero", { amount_minor: 0 }],
    ["a negative amount", { amount_minor: -1 }],
    ["an amount above MAX_SAFE_INTEGER", { amount_minor: Number.MAX_SAFE_INTEGER + 2 }],
    ["a two-letter currency", { currency: "EG" }],
    ["a numeric currency", { currency: "123" }],
    ["string account ids", { from_account_id: "1" }],
    ["the same sender and receiver", { to_account_id: 1 }],
    ["a description over 500 chars", { description: "x".repeat(501) }],
  ])("rejects %s", (_name, patch) => {
    expect(transfer({ ...base, ...patch }).success).toBe(false);
  });

  it("accepts the largest safe integer", () => {
    expect(transfer({ ...base, amount_minor: Number.MAX_SAFE_INTEGER }).success).toBe(true);
  });
});

describe("account schema", () => {
  it("only lets customers open wallets", () => {
    expect(createAccountSchema.safeParse({ body: { currency: "usd" } }).data.body).toEqual({ currency: "USD", kind: "wallet" });
    expect(createAccountSchema.safeParse({ body: { currency: "USD", kind: "system" } }).success).toBe(false);
  });

  it("bounds the statement page size and validates the cursor", () => {
    const parse = (query) => statementQuerySchema.safeParse({ params: { id: "1" }, query });
    expect(parse({}).data.query.limit).toBe(50);
    expect(parse({ limit: "101" }).success).toBe(false);
    expect(parse({ limit: "0" }).success).toBe(false);
    expect(parse({ cursor: "abc" }).success).toBe(false);
    expect(parse({ cursor: "-5" }).success).toBe(false);
    expect(parse({ cursor: "42", limit: "10" }).data.query).toEqual({ cursor: "42", limit: 10 });
  });
});

describe("auth schema", () => {
  it("normalises email and enforces bcrypt's 72-byte password limit", () => {
    expect(registerSchema.safeParse({ body: { email: " A@B.CO ", password: "12345678" } }).data.body.email).toBe("a@b.co");
    expect(registerSchema.safeParse({ body: { email: "a@b.co", password: "short" } }).success).toBe(false);
    expect(registerSchema.safeParse({ body: { email: "a@b.co", password: "x".repeat(73) } }).success).toBe(false);
  });
});
