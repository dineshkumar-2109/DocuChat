// Idempotent schema migration. Runs on every Vercel deploy (see the
// "vercel-build" script) and only needs DATABASE_URL.
import "dotenv/config";
import pg from "pg";
import { pathToFileURL } from "node:url";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,
  password    TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS documents (
  id           UUID PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'processing',  -- processing | ready | failed
  chunk_count  INTEGER NOT NULL DEFAULT 0,
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);

CREATE TABLE IF NOT EXISTS messages (
  id           UUID PRIMARY KEY,
  document_id  UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL,           -- user | assistant
  content      TEXT NOT NULL,
  sources      JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_document ON messages(document_id);

-- Answers to repeated questions; removed automatically with the document.
CREATE TABLE IF NOT EXISTS answer_cache (
  key          TEXT PRIMARY KEY,
  document_id  UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  value        JSONB NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_answer_cache_expires ON answer_cache(expires_at);
`;

export async function migrate() {
  if (!process.env.DATABASE_URL) throw new Error("Missing required env var: DATABASE_URL");
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    await pool.query(SCHEMA);
    console.log("✓ Migration complete");
  } finally {
    await pool.end();
  }
}

// CLI entry point: `npm run migrate`.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  migrate().catch((err) => {
    console.error("Migration failed:", err.message);
    process.exitCode = 1;
  });
}
