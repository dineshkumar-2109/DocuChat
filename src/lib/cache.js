import crypto from "node:crypto";
import { query } from "../db/pool.js";
import { config } from "../config/index.js";

// Answer cache in Postgres. A repeated question skips the embedding call,
// the vector search and the LLM call entirely. Rows are removed with their
// document (ON DELETE CASCADE) and expire after ANSWER_CACHE_TTL seconds.

export function cacheKey(userId, documentId, topK, question) {
  const normalized = question.trim().replace(/\s+/g, " ").toLowerCase();
  const hash = crypto.createHash("sha256").update(`${topK}:${normalized}`).digest("hex");
  return `${userId}:${documentId}:${hash}`;
}

export async function getCachedAnswer(key) {
  try {
    const { rows } = await query("SELECT value FROM answer_cache WHERE key = $1 AND expires_at > now()", [key]);
    return rows[0]?.value ?? null;
  } catch {
    return null; // a cache problem must never break answering
  }
}

export async function setCachedAnswer(key, documentId, value) {
  const expiresAt = new Date(Date.now() + config.cache.answerTtl * 1000);
  try {
    await query(
      `INSERT INTO answer_cache (key, document_id, value, expires_at) VALUES ($1, $2, $3, $4)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at`,
      [key, documentId, JSON.stringify(value), expiresAt]
    );
    await query("DELETE FROM answer_cache WHERE expires_at <= now()");
  } catch {
    // best effort
  }
}
