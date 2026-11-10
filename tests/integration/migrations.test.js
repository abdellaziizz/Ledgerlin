import pg from "pg";
import { describe, expect, it } from "vitest";
import { pool } from "../../db.js";

// Runs the migration runner against a brand-new, empty database.
describe("migrations", () => {
  it("apply cleanly from an empty database and are idempotent", async () => {
    const name = `migtest_${Date.now()}`;
    await pool.query(`CREATE DATABASE ${name}`);
    const url = new URL(process.env.DATABASE_URL);
    url.pathname = `/${name}`;
    const { execFileSync } = await import("child_process");
    const run = () =>
      execFileSync(process.execPath, ["scripts/migrate.js"], {
        env: { ...process.env, DATABASE_URL: url.toString(), ENV_FILE: "/dev/null" },
        encoding: "utf8",
      });
    try {
      expect(run()).toContain("applied 002_audit_log_append_only.sql");
      expect(run()).toContain("database is up to date");

      const client = new pg.Client({ connectionString: url.toString() });
      await client.connect();
      const { rows } = await client.query(
        `SELECT table_name, table_type FROM information_schema.tables
          WHERE table_schema = 'public' ORDER BY table_name`,
      );
      await client.end();
      expect(rows.filter((r) => r.table_type === "BASE TABLE").map((r) => r.table_name)).toEqual([
        "accounts", "audit_log", "entries", "idempotency_keys", "schema_migrations", "transfers", "users",
      ]);
      expect(rows.filter((r) => r.table_type === "VIEW").map((r) => r.table_name)).toEqual(["balance_drift"]);
    } finally {
      await pool.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    }
  });
});
