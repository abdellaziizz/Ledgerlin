import { PostgreSqlContainer } from "@testcontainers/postgresql";

// One disposable PostgreSQL 18 for the whole run. Unit tests don't need it but share the setup.
// Set TEST_DATABASE_URL to reuse an existing empty database instead (e.g. a CI service container).
let container;

export async function setup() {
  process.env.NODE_ENV = "test";
  process.env.ENV_FILE = "/dev/null"; // never read the developer's config.env in tests
  process.env.JWT_SECRET ??= "test-secret-not-for-production-0123456789";
  process.env.JWT_EXPIRES_IN ??= "15m";

  if (process.env.TEST_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  } else {
    container = await new PostgreSqlContainer("postgres:18-alpine")
      .withDatabase("ledgerline")
      .withUsername("ledgerline")
      .withPassword("ledgerline")
      .start();
    process.env.DATABASE_URL = container.getConnectionUri();
  }

  const { migrate } = await import("../scripts/migrate.js");
  await migrate({ log: () => {} });
  const { pool } = await import("../db.js");
  await pool.end();
}

export async function teardown() {
  await container?.stop();
}
