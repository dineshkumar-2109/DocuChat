# DocuChat

[![CI](https://github.com/dineshkumar-2109/DocuChat/actions/workflows/ci.yml/badge.svg)](https://github.com/dineshkumar-2109/DocuChat/actions/workflows/ci.yml)

**Chat with your documents.** Upload a PDF, text or Markdown file, ask questions in
plain language, and get answers that come *only* from that document — each one
with numbered citations that open the exact passage it was based on.

> **Live demo:** `https://<your-project>.vercel.app` · **Try it offline, no keys needed:** `npm install && npm run demo`
>
> Deploying it yourself? See **[DEPLOY.md](DEPLOY.md)** — free on Vercel in about 20 minutes.

---

## What it does

1. **Sign up / sign in** — each account is its own private workspace.
2. **Upload a document** — the upload returns instantly; the document is split, embedded and indexed in the background while the library shows *Indexing → Ready*.
3. **Ask questions** — the app finds the most relevant passages of *that* document and asks the language model to answer using only them.
4. **Verify the answer** — click a citation like `[1]` to see the passage and how closely it matched.
5. **Come back later** — chat history is saved per document; repeated questions are answered instantly from a cache.

## Features

- **Grounded answers with citations** — every answer links to its source passages, with a relevance score.
- **Per-document scope** — retrieval is filtered to the selected document, so answers never mix documents.
- **Private, multi-tenant storage** — each user's vectors live in their own Pinecone namespace, and every query checks ownership.
- **Background ingestion** — uploads respond with `202 Accepted` immediately; transient failures retry with exponential backoff, unfixable ones fail fast with a clear message.
- **Answer cache** — repeated questions skip the embedding call, the vector search and the LLM call.
- **Responsive React UI** — three panes on wide screens, two on laptops, slide-in drawers on tablets and phones; light and dark themes; keyboard shortcuts (`/` to ask, `Esc` to close panels).
- **Security** — JWT auth, scrypt password hashing, Zod input validation, Helmet security headers, per-IP rate limits (stricter on sign-in), ownership checks on every document route.
- **Tested** — 34 end-to-end and unit tests run the real app against in-memory stand-ins for every external service; CI runs them on every push.

## How it works

```
                        ┌────────────── Upload (returns 202 immediately) ──────────────┐
React app ──► /api ──►  │  extract text (PDF/TXT/MD) → Postgres: status "processing"    │
   ▲                    │  background: chunk → embed (OpenAI, batched)                  │
   │                    │             → upsert (Pinecone, user's namespace, batched)    │
   │                    │             → Postgres: status "ready"                        │
   │                    └───────────────────────────────────────────────────────────────┘
   │                    ┌──────────────────────────── Ask ──────────────────────────────┐
   │                    │  cached? ── yes ──► return answer (no external calls)          │
   │                    │     │ no                                                      │
   │                    │  embed question → Pinecone search (user namespace + doc filter)│
   │                    │  → Claude answers from the top passages, citing [1], [2] …     │
   └── answer + sources ┤  → save history + cache answer (in parallel)                  │
                        └───────────────────────────────────────────────────────────────┘
```

On Vercel, the React build is served from the CDN and every `/api/*` request runs
the Express app as a single serverless function.

---

## What we did

The project started as an API-only RAG backend. It was reviewed, tested, fixed and
rebuilt into a deployable full-stack app:

| Area | Change |
|---|---|
| **Bugs fixed** | Malformed document IDs and oversized uploads returned `500` instead of `404`/`413`; the text chunker could loop forever with some settings; answers served from cache were missing from chat history; email addresses were case-sensitive at sign-in; a race between two sign-ups with the same email caused a `500`. |
| **PDF parsing** | Replaced the unmaintained `pdf-parse` (last released 2019; its bundled 2017 pdf.js rejected valid PDFs in testing, and its debug mode can trigger when bundled) with `unpdf`, a maintained, serverless-friendly wrapper around current pdf.js. Tests now use real multi-page PDFs. |
| **Frontend** | Built a React + Vite UI from scratch: sign-in page, document library with live status, chat with clickable citations, sources panel, suggestions, themes, responsive layouts. |
| **Architecture** | Simplified for free serverless hosting — removed Redis, BullMQ, the separate worker process and Docker (see below). |
| **Reliability** | Retries with backoff for transient ingestion failures, fail-fast for unrecoverable ones, cleanup of vectors if a document is deleted mid-ingestion, graceful shutdown that waits for in-flight work. |
| **Testing & CI** | 34 tests (`node:test`) covering auth, uploads, PDF extraction, tenant isolation, retrieval scope, caching, history, deletion and rate limiting; GitHub Actions on Node 22 and 24. |
| **Deployment** | One-click Vercel deployment with automatic database migrations on every deploy. |

## Efficiency and speed improvements

**Fewer moving parts.** The original design needed five services and two processes
(API + queue worker) — Postgres, Redis, Pinecone, OpenAI and Anthropic. Redis was
only used for the queue, the cache and rate-limit counters, so:

- the **queue + worker** were replaced by in-process background ingestion
  (Vercel's `waitUntil` keeps the function alive until indexing finishes);
- the **answer cache** moved into a Postgres table that is deleted automatically
  with its document (`ON DELETE CASCADE`);
- **rate limits** use in-memory counters.

Result: **4 services instead of 5, 1 process instead of 2**, and production
dependencies cut from **17 to 13** (`bullmq`, `ioredis`, `rate-limit-redis`, `cors`,
`uuid` and `pdf-parse` removed; `unpdf` and `@vercel/functions` added). Nothing to
run or pay for besides free tiers.

**Less waiting per request.**

| What | Before | After |
|---|---|---|
| Repeated question | cached in Redis (a separate service); exact text match only; not saved to history | cached in Postgres — **0 external API calls**, matches ignore case and spacing, and the exchange is saved to history |
| Saving a Q&A to history | 2 sequential database writes | **1 write**, run in parallel with the cache write |
| Password hashing at sign-in | `scryptSync` blocked the whole server for every login | async `scrypt` on the thread pool — other requests keep flowing |
| Vector index check | on every server start (every cold start on serverless) | **once per instance**, lazily, on first use |
| Empty / unreadable document | retried 3× with backoff before failing | fails **immediately** with a clear error |
| Background ingestion | needed Redis + a separate always-on worker | runs inside the upload request after the `202` response — no extra infrastructure |

**Already efficient by design.**

- **Batched embeddings** — up to 96 chunks per OpenAI request, so a 100-chunk document needs 2 calls instead of 100.
- **Batched vector writes** — 100 vectors per Pinecone upsert.
- **Scoped search** — each query searches only the caller's namespace and filters to one document.
- **Static assets** — hashed file names served from Vercel's CDN with one-year immutable caching.
- **Region co-location** — the function runs in `iad1` (US East), next to Pinecone (AWS us-east-1) and Neon (US East).

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 7, plain CSS, self-hosted Inter font |
| Backend | Node.js 22+, Express 4, Zod, JSON Web Tokens, Helmet, express-rate-limit, Multer |
| Database | PostgreSQL (Neon serverless Postgres in production) |
| Vector search | Pinecone (serverless, one namespace per user) |
| AI | OpenAI `text-embedding-3-small` for embeddings, Anthropic Claude for answers |
| Document parsing | unpdf (PDF), UTF-8 text (TXT, Markdown) |
| Hosting | Vercel (CDN for the React app, a Vercel Function for the API) |
| Testing & CI | `node:test`, pg-mem, pdf-lib, GitHub Actions |

## Project structure

```
api/
  index.js              Vercel Function entry — exports the Express app
src/
  app.js                Express app: security headers, rate limits, routes
  server.js             Local server: listen + graceful shutdown
  config/index.js       Environment variables (fails fast if one is missing)
  db/
    pool.js             Postgres connection pool
    migrate.js          Idempotent schema migration (runs on every deploy)
  lib/
    chunker.js          Splits text into overlapping, sentence-aligned chunks
    embeddings.js       OpenAI embeddings, batched
    pinecone.js         Vector upsert / search / delete, lazy index creation
    generate.js         Claude prompt and answer generation
    ingest.js           Background ingestion with retries
    cache.js            Postgres-backed answer cache
  middleware/           JWT auth, Zod validation, central error handler
  routes/
    auth.js             Register / sign in
    documents.js        Upload, list, get, delete
    query.js            Ask a question, chat history
web/
  index.html
  public/favicon.svg    The "D" app icon
  src/
    App.jsx             Signed-in / signed-out switch
    AuthPage.jsx        Landing + sign-in / sign-up
    Workspace.jsx       Layout, document polling, drawers
    Sidebar.jsx         Library: upload, search, document list
    ChatPanel.jsx       Conversation, citations, suggestions, composer
    SourcesPanel.jsx    Cited passages with relevance scores
    api.js, theme.js, toast.jsx, icons.jsx, Logo.jsx, format.js
    styles.css          Design tokens, light/dark themes, responsive layout
test/
  api.test.mjs          End-to-end API tests
  chunker.test.mjs      Unit tests
  demo.mjs              Offline demo server (npm run demo)
  fakes/                In-memory Postgres, Pinecone, OpenAI, Anthropic
vercel.json             Build, routing, function and header config
vite.config.js          React build config + dev proxy
```

## Running locally

**Offline demo (no accounts or keys):**

```bash
npm install
npm run demo          # http://localhost:3000
```

Everything runs in memory with stand-ins for the external services; answers are
quoted from the document instead of generated.

**With real services:**

```bash
cp .env.example .env  # fill in the keys — see DEPLOY.md, Step 1
npm install
npm run migrate       # create tables
npm run build         # build the React app
npm start             # http://localhost:3000
```

For frontend development with hot reload, run `npm run dev` (API on :3000) and
`npm run dev:web` (React on :5173, proxying `/api`) in two terminals.

**Tests:** `npm test`

## API

All `/api/documents/*` routes need `Authorization: Bearer <token>`.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Create an account → token |
| POST | `/api/auth/login` | Sign in → token |
| POST | `/api/documents` | Upload a file (multipart field `file`; PDF/TXT/MD, up to 4 MB) → `202` |
| GET | `/api/documents` | List your documents |
| GET | `/api/documents/:id` | One document and its status |
| DELETE | `/api/documents/:id` | Delete a document, its vectors, history and cached answers |
| POST | `/api/documents/:id/ask` | Ask a question: `{ "question": "...", "topK": 4 }` |
| GET | `/api/documents/:id/messages` | Chat history |
| GET | `/health` | Health check |

## Limits and next steps

- Uploads are capped at **4 MB** because Vercel limits request bodies to 4.5 MB. Larger files would need direct-to-storage uploads (e.g. Vercel Blob).
- Rate limits are per server instance; a shared store would make them exact across instances.
- Scanned PDFs (images only) have no extractable text; OCR would be needed.
- Possible additions: streaming answers, questions across several documents, refresh tokens and email verification.

## License

[MIT](LICENSE)
