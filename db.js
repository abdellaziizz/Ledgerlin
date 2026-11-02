import dotenv from "dotenv";

import { Pool } from "pg";
dotenv.config({ path: "./config.env" });
console.log("DB_USER:", process.env.DB_USER);
console.log("DB_HOST:", process.env.DB_HOST);
const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST,
});

const withTransaction = async (fn) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    console.error(err);
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};
export { pool, withTransaction };
