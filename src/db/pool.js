import pg from "pg";
import { config } from "../config/index.js";

const { Pool } = pg;

// Small pool: on serverless each instance is short-lived, and a hosted
// Postgres pooler (e.g. Neon's "-pooler" URL) does the heavy lifting.
export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: parseInt(process.env.PG_POOL_MAX || "5", 10),
  idleTimeoutMillis: 10_000,
});

pool.on("error", (err) => {
  console.error("Unexpected Postgres pool error:", err);
});

// Small helper so callers don't repeat pool.query everywhere.
export function query(text, params) {
  return pool.query(text, params);
}
