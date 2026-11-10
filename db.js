import "./config.js"; // load env before the pool reads it
import pg from "pg";

// bigint (int8) columns are returned as strings by default, which keeps ids and money exact.
const pool = new pg.Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        port: Number(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME,
        host: process.env.DB_HOST,
      },
);

/**
 * Runs fn(client) inside one transaction. Any throw rolls back.
 * isolation: "read committed" (default) | "repeatable read" | "serializable".
 */
const withTransaction = async (fn, { isolation } = {}) => {
  const client = await pool.connect();
  try {
    await client.query(isolation ? `BEGIN ISOLATION LEVEL ${isolation.toUpperCase()}` : "BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
};

export { pool, withTransaction };
