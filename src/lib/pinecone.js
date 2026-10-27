import { Pinecone } from "@pinecone-database/pinecone";
import { config } from "../config/index.js";

const pc = new Pinecone({ apiKey: config.pinecone.apiKey });
const index = pc.index(config.pinecone.index);

const UPSERT_BATCH = 100; // Pinecone recommends <=100 vectors per upsert call.

/**
 * Create the index on first use if it doesn't exist. Memoized, so each
 * server instance checks at most once instead of on every request or
 * cold start.
 */
let indexReady;
function ready() {
  indexReady ??= ensureIndex().catch((err) => {
    indexReady = undefined; // retry on the next call
    throw err;
  });
  return indexReady;
}

async function ensureIndex() {
  const existing = await pc.listIndexes();
  if ((existing.indexes || []).some((i) => i.name === config.pinecone.index)) return;

  console.log(`Creating Pinecone index "${config.pinecone.index}"…`);
  await pc.createIndex({
    name: config.pinecone.index,
    dimension: config.openai.embeddingDim,
    metric: "cosine",
    spec: { serverless: { cloud: "aws", region: "us-east-1" } },
    waitUntilReady: true,
    suppressConflicts: true, // another instance may be creating it at the same time
  });
}

/**
 * Upsert chunk vectors for a document into the user's namespace.
 * records: [{ id, values, metadata }]
 */
export async function upsertChunks(userId, records) {
  await ready();
  const ns = index.namespace(userId);
  for (let i = 0; i < records.length; i += UPSERT_BATCH) {
    await ns.upsert(records.slice(i, i + UPSERT_BATCH));
  }
}

/**
 * Query within a user's namespace, scoped to one document via a metadata
 * filter, so the search only considers that document's chunks.
 */
export async function queryChunks(userId, vector, { topK = 4, documentId } = {}) {
  await ready();
  const res = await index.namespace(userId).query({
    vector,
    topK,
    includeMetadata: true,
    ...(documentId ? { filter: { documentId: { $eq: documentId } } } : {}),
  });
  return res.matches || [];
}

/**
 * Delete all chunks belonging to one document from the user's namespace.
 */
export async function deleteDocumentChunks(userId, documentId) {
  await ready();
  await index.namespace(userId).deleteMany({ documentId: { $eq: documentId } });
}
