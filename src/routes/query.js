import { Router } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import { query } from "../db/pool.js";
import { embedOne } from "../lib/embeddings.js";
import { queryChunks } from "../lib/pinecone.js";
import { generateAnswer } from "../lib/generate.js";
import { cacheKey, getCachedAnswer, setCachedAnswer } from "../lib/cache.js";
import { asyncHandler, isUuid, validateBody } from "../middleware/validate.js";
import { httpError } from "../middleware/error.js";

const router = Router();

// Reject malformed ids up front; Postgres would otherwise throw a 500 on the UUID cast.
router.param("documentId", (req, res, next, id) =>
  isUuid(id) ? next() : next(httpError(404, "Document not found"))
);

const askSchema = z.object({
  question: z.string().trim().min(1).max(2000),
  topK: z.number().int().min(1).max(10).optional(),
});

// Save the question and answer in one round trip.
function saveExchange(documentId, userId, question, answer, sources) {
  return query(
    `INSERT INTO messages (id, document_id, user_id, role, content, sources) VALUES
       ($1, $3, $4, 'user', $5, NULL),
       ($2, $3, $4, 'assistant', $6, $7)`,
    [crypto.randomUUID(), crypto.randomUUID(), documentId, userId, question, answer, JSON.stringify(sources)]
  );
}

// Ask a question about ONE specific document.
// The document is identified by the URL param; retrieval is scoped to it.
router.post(
  "/:documentId/ask",
  validateBody(askSchema),
  asyncHandler(async (req, res) => {
    const { documentId } = req.params;
    const { question, topK = 4 } = req.body;
    const userId = req.user.id;

    // Verify ownership and readiness.
    const doc = await query("SELECT status FROM documents WHERE id = $1 AND user_id = $2", [documentId, userId]);
    if (doc.rowCount === 0) throw httpError(404, "Document not found");
    if (doc.rows[0].status !== "ready") {
      throw httpError(409, `Document is not ready (status: ${doc.rows[0].status})`);
    }

    // Repeated question? Skip embedding, vector search and the LLM entirely.
    const key = cacheKey(userId, documentId, topK, question);
    const cached = await getCachedAnswer(key);
    if (cached) {
      await saveExchange(documentId, userId, question, cached.answer, cached.sources);
      return res.json({ ...cached, cached: true });
    }

    // 1. Embed the question, 2. retrieve from this user's namespace, scoped to this document.
    const qVector = await embedOne(question);
    const matches = await queryChunks(userId, qVector, { topK, documentId });

    if (matches.length === 0) {
      return res.json({ answer: "I couldn't find anything relevant in this document.", sources: [] });
    }

    // 3. Generate a grounded answer.
    const answer = await generateAnswer(question, matches);
    const sources = matches.map((m, i) => ({
      ref: i + 1,
      score: Number((m.score ?? 0).toFixed(4)),
      preview: (m.metadata?.text ?? "").slice(0, 300),
    }));

    // Save history and cache the answer in parallel.
    await Promise.all([
      saveExchange(documentId, userId, question, answer, sources),
      setCachedAnswer(key, documentId, { answer, sources }),
    ]);

    res.json({ answer, sources });
  })
);

// Fetch chat history for a document.
router.get(
  "/:documentId/messages",
  asyncHandler(async (req, res) => {
    const { documentId } = req.params;
    const owned = await query("SELECT id FROM documents WHERE id = $1 AND user_id = $2", [documentId, req.user.id]);
    if (owned.rowCount === 0) throw httpError(404, "Document not found");

    // A question and its answer share a timestamp, so put the question first.
    const result = await query(
      `SELECT role, content, sources, created_at FROM messages WHERE document_id = $1
       ORDER BY created_at ASC, CASE role WHEN 'user' THEN 0 ELSE 1 END`,
      [documentId]
    );
    res.json({ messages: result.rows });
  })
);

export default router;
