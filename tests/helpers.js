import crypto from "crypto";
import request from "supertest";
import app from "../app.js";
import { pool } from "../db.js";
import { createTransfer } from "../services/transferService.js";

export const api = () => request(app);
export const uniqueEmail = (tag = "user") => `${tag}-${crypto.randomUUID().slice(0, 8)}@test.dev`;
export const key = () => `test-${crypto.randomUUID()}`;

/** Registers a customer through the API; returns { token, user, auth } */
export async function registerUser(tag) {
  const email = uniqueEmail(tag);
  const res = await api().post("/api/v1/auth/register").send({ email, password: "password-123" }).expect(201);
  return { token: res.body.token, user: res.body.data.user, email, auth: { Authorization: `Bearer ${res.body.token}` } };
}

export async function makeAuditor() {
  const u = await registerUser("auditor");
  await pool.query("UPDATE users SET role = 'auditor' WHERE id = $1", [u.user.id]);
  return u;
}

export async function openWallet(auth, currency = "EGP") {
  const res = await api().post("/api/v1/accounts").set(auth).send({ currency }).expect(201);
  return res.body.data;
}

/** A system (counterparty) account owned by a fresh treasury user, for funding wallets. */
export async function makeTreasury(currency = "EGP") {
  const u = await registerUser("treasury");
  const { rows } = await pool.query(
    "INSERT INTO accounts (owner_id, currency, kind) VALUES ($1, $2, 'system') RETURNING id",
    [u.user.id, currency],
  );
  return { user: u.user, accountId: rows[0].id };
}

/** Funds a wallet with a real, balanced transfer from a system account. */
export async function fund(treasury, toAccountId, amount_minor, currency = "EGP") {
  const input = { from_account_id: Number(treasury.accountId), to_account_id: Number(toAccountId), amount_minor, currency };
  return createTransfer({ userId: treasury.user.id, idempotencyKey: key(), requestHash: crypto.randomUUID(), input });
}

export const transferReq = (auth, idemKey, body) =>
  api().post("/api/v1/transfers").set(auth).set("Idempotency-Key", idemKey).send(body);

export async function balanceOf(accountId) {
  const { rows } = await pool.query("SELECT balance_cached FROM accounts WHERE id = $1", [accountId]);
  return BigInt(rows[0].balance_cached);
}

export async function derivedBalanceOf(accountId) {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(CASE direction WHEN 'credit' THEN amount_minor ELSE -amount_minor END), 0) AS b
       FROM entries WHERE account_id = $1`,
    [accountId],
  );
  return BigInt(rows[0].b);
}
