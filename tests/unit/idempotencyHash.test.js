import { describe, expect, it } from "vitest";
import { hashRequest } from "../../middleware/idempotencyKey.js";

const req = (body) => ({ method: "POST", baseUrl: "/api/v1/transfers", path: "/", body });

describe("request fingerprint for idempotency keys", () => {
  it("is stable for the same parsed body", () => {
    expect(hashRequest(req({ a: 1, b: "x" }))).toBe(hashRequest(req({ a: 1, b: "x" })));
  });
  it("changes when any parameter changes", () => {
    const h = hashRequest(req({ from_account_id: 1, to_account_id: 2, amount_minor: 100, currency: "EGP" }));
    expect(hashRequest(req({ from_account_id: 1, to_account_id: 2, amount_minor: 101, currency: "EGP" }))).not.toBe(h);
    expect(hashRequest(req({ from_account_id: 1, to_account_id: 3, amount_minor: 100, currency: "EGP" }))).not.toBe(h);
  });
});
