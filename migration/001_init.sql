-- Ledgerline: initial schema
-- Convention: credit = money INTO an account, debit = money OUT of it.
-- balance_cached = SUM(credits) - SUM(debits) over the account's entries.

-- Runs inside the migration runner's transaction (scripts/migrate.js).

CREATE EXTENSION IF NOT EXISTS citext;

-- ---------------------------------------------------------------- types
CREATE TYPE user_role        AS ENUM ('customer', 'auditor');
CREATE TYPE account_kind     AS ENUM ('wallet', 'system');   -- system = counterparty (deposits/withdrawals), may go negative
CREATE TYPE entry_direction  AS ENUM ('debit', 'credit');

-- ---------------------------------------------------------------- users
CREATE TABLE users (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         citext      NOT NULL UNIQUE,
  password_hash text        NOT NULL,
  role          user_role   NOT NULL DEFAULT 'customer',
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------- accounts
-- bigint identity so "lock in ascending id order" is a total order.
CREATE TABLE accounts (
  id             bigint        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner_id       uuid          NOT NULL REFERENCES users(id),
  currency       char(3)       NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  kind           account_kind  NOT NULL DEFAULT 'wallet',
  balance_cached bigint        NOT NULL DEFAULT 0,
  created_at     timestamptz   NOT NULL DEFAULT now(),
  -- overdraft prevention lives in the database, not just in app code
  CONSTRAINT wallet_non_negative CHECK (kind = 'system' OR balance_cached >= 0)
);
CREATE INDEX accounts_owner_idx ON accounts (owner_id);

-- ------------------------------------------------------------ transfers
CREATE TABLE transfers (
  id          bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  timestamptz NOT NULL DEFAULT now(),
  description text
);

-- -------------------------------------------------------------- entries
CREATE TABLE entries (
  id           bigint           GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  transfer_id  bigint           NOT NULL REFERENCES transfers(id),
  account_id   bigint           NOT NULL REFERENCES accounts(id),
  amount_minor bigint           NOT NULL CHECK (amount_minor > 0),  -- integer minor units, sign comes from direction
  direction    entry_direction  NOT NULL
);
CREATE INDEX entries_transfer_idx ON entries (transfer_id);
-- statement keyset pagination: WHERE account_id = $1 AND id < $2 ORDER BY id DESC
CREATE INDEX entries_account_id_idx ON entries (account_id, id);

-- Immutability: no UPDATE / DELETE / TRUNCATE on entries.
CREATE FUNCTION entries_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'entries is append-only (% not allowed)', TG_OP
    USING ERRCODE = 'integrity_constraint_violation';
END $$;

CREATE TRIGGER entries_no_update_delete
  BEFORE UPDATE OR DELETE ON entries
  FOR EACH ROW EXECUTE FUNCTION entries_immutable();

CREATE TRIGGER entries_no_truncate
  BEFORE TRUNCATE ON entries
  FOR EACH STATEMENT EXECUTE FUNCTION entries_immutable();

-- Balanced: per transfer, per currency, credits == debits, and >= 2 entries.
-- DEFERRABLE INITIALLY DEFERRED so it runs once at COMMIT, after both rows exist.
CREATE FUNCTION check_transfer_balanced() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  bad record;
  n   int;
BEGIN
  SELECT count(*) INTO n FROM entries WHERE transfer_id = NEW.transfer_id;
  IF n < 2 THEN
    RAISE EXCEPTION 'transfer % has % entries; need at least 2', NEW.transfer_id, n
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT a.currency,
         SUM(CASE e.direction WHEN 'credit' THEN e.amount_minor ELSE -e.amount_minor END) AS net
    INTO bad
    FROM entries e
    JOIN accounts a ON a.id = e.account_id
   WHERE e.transfer_id = NEW.transfer_id
   GROUP BY a.currency
  HAVING SUM(CASE e.direction WHEN 'credit' THEN e.amount_minor ELSE -e.amount_minor END) <> 0
   LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'transfer % is unbalanced in % (net %)', NEW.transfer_id, bad.currency, bad.net
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END $$;

CREATE CONSTRAINT TRIGGER entries_balanced
  AFTER INSERT ON entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION check_transfer_balanced();

-- ------------------------------------------------------ idempotency_keys
CREATE TABLE idempotency_keys (
  user_id       uuid        NOT NULL REFERENCES users(id),
  key           text        NOT NULL CHECK (length(key) BETWEEN 1 AND 255),
  request_hash  text        NOT NULL,          -- hash of method+path+body; mismatch on reuse => 422
  response_code int,                           -- NULL until the request finishes
  response_body jsonb,
  locked_at     timestamptz,                   -- set while a request is in flight
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)                   -- the unique index that makes claiming a key atomic
);

-- ------------------------------------------------------------ audit_log
CREATE TABLE audit_log (
  id          bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id    uuid        REFERENCES users(id),
  action      text        NOT NULL,            -- e.g. 'transfer.created', 'reconcile.run'
  entity_type text,
  entity_id   text,
  metadata    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_actor_idx  ON audit_log (actor_id, id);
CREATE INDEX audit_log_entity_idx ON audit_log (entity_type, entity_id);

-- ------------------------------------------------- reconciliation view
-- Used by POST /admin/reconcile: any row returned is a bug.
CREATE VIEW balance_drift AS
SELECT a.id AS account_id,
       a.balance_cached,
       COALESCE(SUM(CASE e.direction WHEN 'credit' THEN e.amount_minor ELSE -e.amount_minor END), 0) AS balance_derived
  FROM accounts a
  LEFT JOIN entries e ON e.account_id = a.id
 GROUP BY a.id, a.balance_cached
HAVING a.balance_cached <> COALESCE(SUM(CASE e.direction WHEN 'credit' THEN e.amount_minor ELSE -e.amount_minor END), 0);
