// Applies migration/*.sql in filename order, each in its own transaction, exactly once.
// Usage: node scripts/migrate.js   (reads DB settings from config.env / environment)
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "../db.js";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "migration");
const LOCK_ID = 7_242_001; // pg_advisory_lock key: only one migrator at a time

export async function migrate({ log = console.log } = {}) {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [LOCK_ID]);
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version    text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);

    // Databases created before this runner existed already have 001 applied by hand.
    const { rows: [state] } = await client.query(
      `SELECT (SELECT count(*) FROM schema_migrations)::int AS recorded,
              to_regclass('public.accounts') IS NOT NULL AS has_schema`,
    );
    if (state.recorded === 0 && state.has_schema) {
      await client.query("INSERT INTO schema_migrations (version) VALUES ('001_init.sql')");
      log("baselined existing schema as 001_init.sql");
    }

    const { rows } = await client.query("SELECT version FROM schema_migrations");
    const applied = new Set(rows.map((r) => r.version));
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

    let count = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = fs.readFileSync(path.join(dir, file), "utf8");
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [file]);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw new Error(`migration ${file} failed: ${err.message}`, { cause: err });
      }
      log(`applied ${file}`);
      count++;
    }
    if (count === 0) log("database is up to date");
    return count;
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [LOCK_ID]).catch(() => {});
    client.release();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  migrate()
    .then(() => pool.end())
    .catch(async (err) => {
      console.error(err.message);
      await pool.end();
      process.exit(1);
    });
}
