// Seeds a working demo: a treasury (system accounts), an auditor, and two customers whose
// wallets are funded through the real transfer service. Safe to re-run: users and accounts are
// reused, and every transfer has a fixed Idempotency-Key, so a second run replays instead of
// moving money twice.
// Usage: node scripts/seed.js
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { pool } from "../db.js";
import { createTransfer } from "../services/transferService.js";

export const DEMO = {
  customer: { email: "demo@ledgerline.dev", password: "demo-pass-123" },
  customer2: { email: "omar@ledgerline.dev", password: "demo-pass-123" },
  auditor: { email: "auditor@ledgerline.dev", password: "audit-pass-123" },
  treasury: { email: "treasury@ledgerline.internal" },
};

async function upsertUser(email, password, role = "customer") {
  // Treasury gets a random password nobody knows: it exists only to own system accounts.
  const hash = await bcrypt.hash(password ?? crypto.randomBytes(32).toString("hex"), 12);
  await pool.query(
    `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING`,
    [email, hash, role],
  );
  const { rows } = await pool.query("SELECT id, email, role FROM users WHERE email = $1", [email]);
  return rows[0];
}

// Returns the n-th account of (owner, currency, kind), creating it if missing.
async function ensureAccount(ownerId, currency, kind, n = 0) {
  const { rows } = await pool.query(
    "SELECT id FROM accounts WHERE owner_id = $1 AND currency = $2 AND kind = $3 ORDER BY id",
    [ownerId, currency, kind],
  );
  if (rows[n]) return rows[n].id;
  const { rows: created } = await pool.query(
    "INSERT INTO accounts (owner_id, currency, kind) VALUES ($1, $2, $3) RETURNING id",
    [ownerId, currency, kind],
  );
  return created[0].id;
}

async function transfer(user, key, from, to, amount_minor, currency, description) {
  const input = { from_account_id: Number(from), to_account_id: Number(to), amount_minor, currency, description };
  const requestHash = crypto.createHash("sha256").update(`seed ${JSON.stringify(input)}`).digest("hex");
  return createTransfer({ userId: user.id, idempotencyKey: key, requestHash, input });
}

export async function seed({ log = console.log } = {}) {
  const treasury = await upsertUser(DEMO.treasury.email, null);
  const auditor = await upsertUser(DEMO.auditor.email, DEMO.auditor.password, "auditor");
  const demo = await upsertUser(DEMO.customer.email, DEMO.customer.password);
  const omar = await upsertUser(DEMO.customer2.email, DEMO.customer2.password);

  // System (counterparty) accounts stand in for the outside world: payroll, merchants, cards.
  const egpSystem = await ensureAccount(treasury.id, "EGP", "system");
  const usdSystem = await ensureAccount(treasury.id, "USD", "system");

  const main = await ensureAccount(demo.id, "EGP", "wallet", 0);
  const savings = await ensureAccount(demo.id, "EGP", "wallet", 1);
  const usd = await ensureAccount(demo.id, "USD", "wallet", 0);
  const omarWallet = await ensureAccount(omar.id, "EGP", "wallet", 0);

  const steps = [
    [treasury, "seed-001", egpSystem, main, 4_500_000, "EGP", "Salary — October"],
    [demo, "seed-002", main, savings, 1_200_000, "EGP", "Move to savings"],
    [demo, "seed-003", main, egpSystem, 875_050, "EGP", "Rent — Zamalek apartment"],
    [demo, "seed-004", main, egpSystem, 64_990, "EGP", "Vodafone bill"],
    [treasury, "seed-005", egpSystem, main, 250_000, "EGP", "Freelance invoice #118"],
    [demo, "seed-006", main, egpSystem, 182_500, "EGP", "Groceries — Gourmet"],
    [demo, "seed-007", main, omarWallet, 150_000, "EGP", "Dinner split with Omar"],
    [treasury, "seed-008", egpSystem, omarWallet, 2_000_000, "EGP", "Salary — October"],
    [omar, "seed-009", omarWallet, main, 40_000, "EGP", "Football tickets"],
    [demo, "seed-010", savings, main, 300_000, "EGP", "Top-up from savings"],
    [treasury, "seed-011", usdSystem, usd, 120_000, "USD", "Upwork payout"],
    [demo, "seed-012", usd, usdSystem, 1_999, "USD", "Figma subscription"],
    [demo, "seed-013", main, egpSystem, 38_075, "EGP", "Electricity"],
    [demo, "seed-014", main, egpSystem, 8_500, "EGP", "Coffee — Café Riche"],
  ];
  let created = 0;
  for (const [user, key, from, to, amount, currency, description] of steps) {
    const result = await transfer(user, key, from, to, amount, currency, description);
    if (!result.replayed) created++;
  }

  log(`seed: ${created} new transfers, ${steps.length - created} replayed (already seeded)`);
  log(`  customer  ${DEMO.customer.email} / ${DEMO.customer.password}  (EGP #${main}, EGP #${savings}, USD #${usd})`);
  log(`  customer  ${DEMO.customer2.email} / ${DEMO.customer2.password}  (EGP #${omarWallet})`);
  log(`  auditor   ${DEMO.auditor.email} / ${DEMO.auditor.password}`);
  log(`  system    EGP #${egpSystem}, USD #${usdSystem} (owned by ${DEMO.treasury.email})`);
  return { treasury, auditor, demo, omar, accounts: { egpSystem, usdSystem, main, savings, usd, omarWallet } };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seed()
    .then(() => pool.end())
    .catch(async (err) => {
      console.error(err);
      await pool.end();
      process.exit(1);
    });
}
