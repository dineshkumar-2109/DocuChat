import { Router } from "express";
import multer from "multer";
import crypto from "node:crypto";
import { extractText as extractPdfText, getDocumentProxy } from "unpdf";
import { query } from "../db/pool.js";
import { deleteDocumentChunks } from "../lib/pinecone.js";
import { startIngestion } from "../lib/ingest.js";
import { asyncHandler, isUuid } from "../middleware/validate.js";
import { httpError } from "../middleware/error.js";
import { config } from "../config/index.js";

const router = Router();

// Reject malformed ids up front; Postgres would otherwise throw a 500 on the UUID cast.
router.param("id", (req, res, next, id) =>
  isUuid(id) ? next() : next(httpError(404, "Document not found"))
);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.limits.maxUploadBytes },
});

// Extract raw text from an uploaded buffer based on mimetype, falling back
// to the extension (browsers often send "" or octet-stream for .md files).
async function extractText(file) {
  const ext = file.originalname.split(".").pop()?.toLowerCase();
  if (file.mimetype === "application/pdf" || ext === "pdf") {
    try {
      // verbosity 0: only errors, no pdf.js warnings in the server logs.
      const pdf = await getDocumentProxy(new Uint8Array(file.buffer), { verbosity: 0 });
      const { text } = await extractPdfText(pdf, { mergePages: true });
      return text;
    } catch {
      throw httpError(422, "Could not read this PDF (it may be corrupted or encrypted)");
    }
  }
  if (file.mimetype.startsWith("text/") || ["txt", "md", "markdown"].includes(ext)) {
    return file.buffer.toString("utf-8");
  }
  throw httpError(415, `Unsupported file type: ${file.mimetype || ext}`);
}

// Upload a document. Responds 202 immediately; chunking, embedding and
// indexing continue in the background (see lib/ingest.js).
router.post(
  "/",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw httpError(400, "file is required");

    const text = await extractText(req.file);
    const documentId = crypto.randomUUID();
    const name = req.file.originalname;

    await query(
      "INSERT INTO documents (id, user_id, name, status) VALUES ($1, $2, $3, 'processing')",
      [documentId, req.user.id, name]
    );

    startIngestion({ userId: req.user.id, documentId, text });

    res.status(202).json({ id: documentId, name, status: "processing" });
  })
);

// List the caller's documents.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const result = await query(
      `SELECT id, name, status, chunk_count, error, created_at
       FROM documents WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json({ documents: result.rows });
  })
);

// Get a single document (ownership enforced).
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const result = await query(
      `SELECT id, name, status, chunk_count, error, created_at
       FROM documents WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (result.rowCount === 0) throw httpError(404, "Document not found");
    res.json(result.rows[0]);
  })
);

// Delete a document, its vectors, chat history and cached answers
// (the last two cascade from the documents row).
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const result = await query("SELECT id FROM documents WHERE id = $1 AND user_id = $2", [req.params.id, req.user.id]);
    if (result.rowCount === 0) throw httpError(404, "Document not found");

    await deleteDocumentChunks(req.user.id, req.params.id);
    await query("DELETE FROM documents WHERE id = $1", [req.params.id]);
    res.status(204).end();
  })
);

export default router;
