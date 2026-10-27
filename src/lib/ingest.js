import { waitUntil } from "@vercel/functions";
import { query } from "../db/pool.js";
import { chunkText } from "./chunker.js";
import { embed } from "./embeddings.js";
import { upsertChunks, deleteDocumentChunks } from "./pinecone.js";

const MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 2000;

// Errors that retrying can't fix (e.g. a document with no text).
export class UnrecoverableError extends Error {}

/**
 * Process one document: chunk → embed → upsert → mark ready.
 */
export async function processDocument({ userId, documentId, text }) {
  const chunks = chunkText(text);
  if (chunks.length === 0) throw new UnrecoverableError("No extractable text");

  const vectors = await embed(chunks);
  const records = chunks.map((chunk, i) => ({
    id: `${documentId}#${i}`,
    values: vectors[i],
    metadata: { userId, documentId, chunkIndex: i, text: chunk },
  }));

  await upsertChunks(userId, records);

  const result = await query(
    "UPDATE documents SET status = 'ready', chunk_count = $1, updated_at = now() WHERE id = $2",
    [chunks.length, documentId]
  );

  // The document was deleted while we were processing it; don't leave
  // orphaned vectors behind.
  if (result.rowCount === 0) {
    await deleteDocumentChunks(userId, documentId);
    return 0;
  }
  return chunks.length;
}

// Retries transient failures with exponential backoff, then marks the
// document failed so the UI can show why.
async function runWithRetries(job) {
  for (let attempt = 1; ; attempt++) {
    try {
      const chunks = await processDocument(job);
      console.log(`✓ Ingested ${job.documentId} (${chunks} chunks)`);
      return;
    } catch (err) {
      const final = err instanceof UnrecoverableError || attempt >= MAX_ATTEMPTS;
      console.error(`Ingestion of ${job.documentId} failed (attempt ${attempt}):`, err.message);
      if (final) {
        await query(
          "UPDATE documents SET status = 'failed', error = $1, updated_at = now() WHERE id = $2",
          [err.message, job.documentId]
        ).catch(() => {});
        return;
      }
      await new Promise((r) => setTimeout(r, RETRY_BASE_MS * 2 ** (attempt - 1)));
    }
  }
}

const inFlight = new Set();

/**
 * Start ingesting in the background and return immediately, so uploads
 * respond with 202 straight away. On Vercel, waitUntil keeps the function
 * alive until the work finishes; locally it's a no-op and the promise just
 * runs on the server's event loop.
 */
export function startIngestion(job) {
  const task = runWithRetries(job).finally(() => inFlight.delete(task));
  inFlight.add(task);
  waitUntil(task);
  return task;
}

/** Resolves once all in-flight ingestion has finished (graceful shutdown). */
export function drainIngestion() {
  return Promise.allSettled([...inFlight]);
}
