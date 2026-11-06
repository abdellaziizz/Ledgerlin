/**
 * Money helpers. The backend stores and returns money as integer minor units
 * (piastres, cents), serialised as strings because they are Postgres bigints.
 * Everything here works on BigInt and decimal strings; no floating point is used
 * for any amount.
 */

export type MinorUnits = bigint;

const MINUS = "−"; // typographic minus, aligns with "+" in tabular figures

/** The backend's transfer schema caps amount_minor at Number.MAX_SAFE_INTEGER. */
export const MAX_TRANSFER_MINOR = BigInt(Number.MAX_SAFE_INTEGER);

const digitsCache = new Map<string, number>();

/** Number of minor-unit digits for an ISO 4217 code (EGP 2, JPY 0, KWD 3). */
export function minorDigits(currency: string): number {
  const code = currency.toUpperCase();
  const cached = digitsCache.get(code);
  if (cached !== undefined) return cached;
  let digits = 2;
  try {
    digits = new Intl.NumberFormat("en", { style: "currency", currency: code })
      .resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    digits = 2; // unknown code: the backend only checks the ^[A-Z]{3}$ shape
  }
  digitsCache.set(code, digits);
  return digits;
}

export function toMinor(value: string | number | bigint | null | undefined): MinorUnits {
  if (value === null || value === undefined || value === "") return 0n;
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new RangeError("minor units must be a safe integer");
    return BigInt(value);
  }
  if (!/^-?\d+$/.test(value)) throw new RangeError(`not an integer minor amount: ${value}`);
  return BigInt(value);
}

/** 150000n, 2 -> "1500.00" (exact decimal string, no grouping). */
export function minorToDecimalString(minor: MinorUnits, digits: number): string {
  const negative = minor < 0n;
  const abs = negative ? -minor : minor;
  const s = abs.toString().padStart(digits + 1, "0");
  const int = digits === 0 ? s : s.slice(0, -digits);
  const frac = digits === 0 ? "" : s.slice(-digits);
  return `${negative ? "-" : ""}${int}${frac ? `.${frac}` : ""}`;
}

const formatterCache = new Map<string, Intl.NumberFormat>();
function decimalFormatter(digits: number, compact = false): Intl.NumberFormat {
  const key = `${digits}:${compact}`;
  let f = formatterCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(undefined, compact
      ? { notation: "compact", maximumFractionDigits: 1 }
      : { minimumFractionDigits: digits, maximumFractionDigits: digits });
    formatterCache.set(key, f);
  }
  return f;
}

export interface FormatOptions {
  /** Prefix "+" for positive values and "−" for negative ones. */
  signed?: boolean;
  /** Compact notation (12.9K), for chart axes only. */
  compact?: boolean;
}

/**
 * Formats minor units as a grouped decimal, without the currency code
 * (the UI renders the code separately so it can be styled as a quiet label).
 * Intl formats the decimal *string*, which is exact, so large values never round.
 */
export function formatMinor(
  value: string | number | bigint,
  currency: string,
  { signed = false, compact = false }: FormatOptions = {},
): string {
  const minor = toMinor(value);
  const digits = minorDigits(currency);
  const abs = minor < 0n ? -minor : minor;
  const decimal = minorToDecimalString(abs, digits);
  const body = decimalFormatter(digits, compact).format(
    decimal as Intl.StringNumericLiteral,
  );
  if (minor < 0n) return `${MINUS}${body}`;
  if (signed && minor > 0n) return `+${body}`;
  return body;
}

/** "EGP 1,500.00" — for plain-text contexts such as toasts and aria labels. */
export function formatMoney(value: string | number | bigint, currency: string, opts?: FormatOptions) {
  return `${currency} ${formatMinor(value, currency, opts)}`;
}

export type ParseResult =
  | { ok: true; minor: MinorUnits }
  | { ok: false; error: string };

/**
 * Parses what a person typed ("1,250.5") into minor units for `currency`.
 * Pure string arithmetic: "1250.5" with 2 digits -> 125050n.
 */
export function parseAmount(input: string, currency: string): ParseResult {
  const digits = minorDigits(currency);
  const cleaned = input.replace(/[\s,_]/g, "");
  if (cleaned === "") return { ok: false, error: "Enter an amount" };
  if (!/^\d*\.?\d*$/.test(cleaned) || cleaned === ".") {
    return { ok: false, error: "Use digits and an optional decimal point" };
  }
  const [intPart = "", fracPart = ""] = cleaned.split(".");
  if (fracPart.length > digits) {
    return {
      ok: false,
      error: digits === 0
        ? `${currency} has no decimal places`
        : `${currency} allows at most ${digits} decimal place${digits === 1 ? "" : "s"}`,
    };
  }
  const minor = BigInt((intPart || "0") + fracPart.padEnd(digits, "0"));
  if (minor <= 0n) return { ok: false, error: "Amount must be greater than zero" };
  if (minor > MAX_TRANSFER_MINOR) return { ok: false, error: "Amount is too large" };
  return { ok: true, minor };
}

/** Keeps an amount input to digits, one decimal point, and the currency's precision. */
export function sanitizeAmountInput(raw: string, currency: string): string {
  const digits = minorDigits(currency);
  let s = raw.replace(/[^\d.]/g, "");
  const dot = s.indexOf(".");
  if (dot !== -1) {
    s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, "");
    if (digits === 0) s = s.slice(0, dot);
    else s = s.slice(0, dot + 1 + digits);
  }
  return s.replace(/^0+(?=\d)/, "");
}

/** Sums minor-unit balances grouped by currency. */
export function sumByCurrency(items: { currency: string; minor: MinorUnits }[]) {
  const totals = new Map<string, MinorUnits>();
  for (const { currency, minor } of items) {
    totals.set(currency, (totals.get(currency) ?? 0n) + minor);
  }
  return totals;
}

/**
 * Minor units -> Number for chart geometry only (pixel positions, axis ticks).
 * Never use the result for arithmetic on money.
 */
export function minorToChartNumber(minor: MinorUnits, currency: string): number {
  return Number(minorToDecimalString(minor, minorDigits(currency)));
}
