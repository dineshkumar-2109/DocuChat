// The Express application. Used by src/server.js (local / any Node host)
// and api/index.js (Vercel Function).
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { authenticate } from "./middleware/auth.js";
import { notFound, errorHandler } from "./middleware/error.js";
import authRoutes from "./routes/auth.js";
import documentRoutes from "./routes/documents.js";
import queryRoutes from "./routes/query.js";

const app = express();

// Behind a proxy (Vercel, nginx, ...) the client IP arrives in
// X-Forwarded-For. Without this, every user shares one rate-limit bucket.
app.set("trust proxy", parseInt(process.env.TRUST_PROXY || "1", 10));
app.disable("x-powered-by");

app.use(helmet());
app.use(express.json({ limit: "100kb" }));

// Per-IP rate limits (in memory, per server instance).
const limiter = (windowMs, max) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later." },
  });

app.get("/health", (req, res) => res.json({ status: "ok" }));
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.use("/api", limiter(60 * 1000, 100));

// Public auth routes, with a tighter limit to slow down password guessing.
app.use("/api/auth", limiter(15 * 60 * 1000, 20), authRoutes);

// Everything below requires a valid token.
app.use("/api/documents", authenticate, documentRoutes);
app.use("/api/documents", authenticate, queryRoutes); // /:documentId/ask, /messages

// Local / non-Vercel hosting: serve the React build (on Vercel the CDN does this).
const webDist = fileURLToPath(new URL("../web/dist", import.meta.url));
const indexHtml = path.join(webDist, "index.html");
if (existsSync(indexHtml)) {
  app.use(express.static(webDist, { index: false, maxAge: "1h" }));
  app.get(/^\/(?!api\/|health$).*/, (req, res) => res.set("Cache-Control", "no-cache").sendFile(indexHtml));
}

app.use(notFound);
app.use(errorHandler);

export default app;
