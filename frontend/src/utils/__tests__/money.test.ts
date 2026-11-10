import { describe, expect, it } from "vitest";
import {
  formatMinor,
  MAX_TRANSFER_MINOR,
  minorDigits,
  minorToDecimalString,
  parseAmount,
  sanitizeAmountInput,
  sumByCurrency,
} from "../money";

describe("minorDigits", () => {
  it("follows ISO 4217 precision", () => {
    expect(minorDigits("EGP")).toBe(2);
    expect(minorDigits("JPY")).toBe(0);
    expect(minorDigits("KWD")).toBe(3);
    expect(minorDigits("ZZZ")).toBe(2); // unknown codes fall back to 2
  });
});

describe("parseAmount (no floating point)", () => {
  it("converts typed decimals to exact minor units", () => {
    expect(parseAmount("1250.75", "EGP")).toEqual({ ok: true, minor: 125075n });
    expect(parseAmount("1,250.5", "EGP")).toEqual({ ok: true, minor: 125050n });
    expect(parseAmount("0.1", "EGP")).toEqual({ ok: true, minor: 10n }); // 0.1 is exact here, unlike 0.1 * 100 in floats
    expect(parseAmount("1.005", "KWD")).toEqual({ ok: true, minor: 1005n });
    expect(parseAmount("500", "JPY")).toEqual({ ok: true, minor: 500n });
  });

  it("rejects bad input", () => {
    expect(parseAmount("", "EGP").ok).toBe(false);
    expect(parseAmount("0", "EGP").ok).toBe(false);
    expect(parseAmount("1.234", "EGP").ok).toBe(false);
    expect(parseAmount("1.5", "JPY").ok).toBe(false);
    expect(parseAmount("-5", "EGP").ok).toBe(false);
    expect(parseAmount("1e3", "EGP").ok).toBe(false);
    expect(parseAmount("abc", "EGP").ok).toBe(false);
  });

  it("caps amounts at the backend's MAX_SAFE_INTEGER limit", () => {
    expect(parseAmount(minorToDecimalString(MAX_TRANSFER_MINOR, 2), "EGP")).toEqual({ ok: true, minor: MAX_TRANSFER_MINOR });
    expect(parseAmount(minorToDecimalString(MAX_TRANSFER_MINOR + 1n, 2), "EGP").ok).toBe(false);
  });
});

describe("formatting", () => {
  it("renders minor units as decimals without rounding large values", () => {
    expect(minorToDecimalString(5n, 2)).toBe("0.05");
    expect(minorToDecimalString(-150000n, 2)).toBe("-1500.00");
    expect(formatMinor("123456789012345678", "EGP")).toBe("1,234,567,890,123,456.78");
  });

  it("uses a true minus sign and an optional plus", () => {
    expect(formatMinor("-38075", "EGP")).toBe("−380.75");
    expect(formatMinor("38075", "EGP", { signed: true })).toBe("+380.75");
    expect(formatMinor("0", "EGP", { signed: true })).toBe("0.00");
  });
});

describe("sanitizeAmountInput", () => {
  it("keeps digits, one point and the currency's precision", () => {
    expect(sanitizeAmountInput("1,250.755", "EGP")).toBe("1250.75");
    expect(sanitizeAmountInput("12.3.4", "EGP")).toBe("12.34");
    expect(sanitizeAmountInput("007", "EGP")).toBe("7");
    expect(sanitizeAmountInput("12.5", "JPY")).toBe("12");
  });
});

describe("sumByCurrency", () => {
  it("never mixes currencies", () => {
    const totals = sumByCurrency([
      { currency: "EGP", minor: 100n },
      { currency: "USD", minor: 5n },
      { currency: "EGP", minor: 250n },
    ]);
    expect(Object.fromEntries(totals)).toEqual({ EGP: 350n, USD: 5n });
  });
});
