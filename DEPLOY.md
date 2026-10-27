# Deploying DocuChat to Vercel (free)

This guide takes you from zero to a live URL like `https://docuchat-yourname.vercel.app`.

**Time:** about 20 minutes. **Hosting cost:** free. The only spend is AI usage
(OpenAI + Anthropic), which is a few cents for a demo — and you can cap it.

---

## Overview: what you need

| # | Service | What it's for | Free? | What you copy |
|---|---|---|---|---|
| 1 | [Neon](https://neon.tech) | Postgres database: users, documents, chat history, answer cache | ✅ Free plan | `DATABASE_URL` |
| 2 | [Pinecone](https://www.pinecone.io) | Vector search over document passages | ✅ Free Starter plan | `PINECONE_API_KEY` |
| 3 | [OpenAI](https://platform.openai.com) | Turns text into embeddings for search | 💲 Pay-as-you-go (cents) | `OPENAI_API_KEY` |
| 4 | [Anthropic](https://console.anthropic.com) | Writes the answers (Claude) | 💲 Pay-as-you-go (cents) | `ANTHROPIC_API_KEY` |
| 5 | You | Signs login tokens | ✅ | `JWT_SECRET` (you generate it) |
| 6 | [GitHub](https://github.com) | Hosts the code Vercel deploys from | ✅ | — |
| 7 | [Vercel](https://vercel.com) | Hosts the app | ✅ Hobby plan | — |

Keep every key in a password manager or private note. **Never commit them to Git** —
`.env` is already in `.gitignore`.

---

## Step 1 — Get your keys

Do these first; you'll paste them into Vercel in Step 3.

### 1.1 Neon (database) → `DATABASE_URL`

1. Sign up at <https://neon.tech> and click **Create project**.
2. Region: **AWS US East (N. Virginia)** — the same region the app runs in on Vercel.
3. On the project dashboard click **Connect**.
4. Turn on **Connection pooling** and copy the connection string. It looks like:
   ```
   postgresql://neondb_owner:xxxxxxxx@ep-xxxx-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require
   ```
   Use the **pooled** string (it has `-pooler` in the host) — it's built for serverless.
   You don't need to create any tables; the app does that on every deploy.

### 1.2 Pinecone (vector search) → `PINECONE_API_KEY`

1. Sign up at <https://app.pinecone.io> (Starter plan is free).
2. Go to **API Keys** and copy the default key.
3. You **don't** need to create an index — the app creates one called `docuchat`
   (1536 dimensions, cosine, AWS us-east-1) the first time it's used.

### 1.3 OpenAI (embeddings) → `OPENAI_API_KEY`

1. Sign up at <https://platform.openai.com>.
2. **Settings → Billing**: add a small credit, e.g. $5.
3. **Settings → Limits**: set a low monthly budget so a demo can never surprise you.
4. **API keys → Create new secret key**. Copy it (starts with `sk-`).

### 1.4 Anthropic (answers) → `ANTHROPIC_API_KEY`

1. Sign up at <https://console.anthropic.com>.
2. **Billing**: add a small credit, e.g. $5.
3. **Limits**: set a low monthly spend limit.
4. **API Keys → Create Key**. Copy it (starts with `sk-ant-`).

### 1.5 JWT secret → `JWT_SECRET`

Any long random string. Generate one with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

You should now have these five values:

```
DATABASE_URL=postgresql://...-pooler...neon.tech/neondb?sslmode=require
PINECONE_API_KEY=...
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
JWT_SECRET=...
```

---

## Step 2 — Push the code to GitHub

From the project folder:

```bash
git push -u origin main
```

> **"Permission denied to &lt;another account&gt;"?** Windows is using a saved login for a
> different GitHub account. Open **Windows Credential Manager → Windows Credentials**,
> remove the `git:https://github.com` entry, push again, and sign in as the repo owner.

---

## Step 3 — Deploy on Vercel

1. Sign up at <https://vercel.com> with your GitHub account (Hobby plan is free).
2. Click **Add New… → Project**, find the **DocuChat** repository and click **Import**.
3. Leave the build settings as they are — `vercel.json` already configures everything:

   | Setting | Value (from `vercel.json`) |
   |---|---|
   | Framework | Vite |
   | Install command | `npm ci` |
   | Build command | `npm run vercel-build` (builds the React app **and** runs the database migration) |
   | Output directory | `web/dist` |

4. Open **Environment Variables** and add the five values from Step 1:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | Neon pooled connection string |
   | `PINECONE_API_KEY` | Pinecone key |
   | `OPENAI_API_KEY` | OpenAI key |
   | `ANTHROPIC_API_KEY` | Anthropic key |
   | `JWT_SECRET` | your generated secret |

   Leave them enabled for all environments (Production, Preview, Development).
5. Click **Deploy** and wait 1–2 minutes. In the build log you should see:
   ```
   ✓ built in …
   ✓ Migration complete
   ```

---

## Step 4 — Check it works

1. Open `https://<your-project>.vercel.app/health` → `{"status":"ok"}`.
2. Open `https://<your-project>.vercel.app` → the DocuChat sign-in page.
3. Create an account, upload a PDF (up to 4 MB) and wait for **Ready**.
   The very first upload also creates the Pinecone index, so it can take ~30 seconds.
4. Ask a question — you should get an answer with clickable `[1]` citations.
5. Ask the same question again — it shows **Instant** (served from the cache).

Put your URL in the README's **Live demo** line, on your CV and on LinkedIn.

---

## Updating the app

Every push to `main` deploys automatically, and every pull request gets its own
preview URL. GitHub Actions runs the tests on every push (**Actions** tab).

Optional settings (Vercel → Project → **Settings → Environment Variables**, then redeploy):

| Name | Default | Purpose |
|---|---|---|
| `ANTHROPIC_MODEL` | `claude-sonnet-5-5` | Claude model used for answers |
| `ANSWER_CACHE_TTL` | `86400` | Seconds a cached answer stays valid |
| `MAX_UPLOAD_MB` | `4` | Upload limit (keep ≤ 4 on Vercel) |
| `PINECONE_INDEX` | `docuchat` | Vector index name |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Build fails with `Missing required env var: DATABASE_URL` | The variable isn't set (or not for that environment). Add it under **Settings → Environment Variables**, then **Deployments → ⋯ → Redeploy**. |
| Build fails at `Migration failed` | `DATABASE_URL` is wrong or incomplete — re-copy it from Neon, including `?sslmode=require`. |
| Sign-up / every request returns 500 | A runtime variable is missing. Check **Deployments → your deployment → Logs** for `Missing required env var`. |
| Document shows **Failed** with an OpenAI error | No OpenAI credit, or a wrong `OPENAI_API_KEY`. Add credit, redeploy, upload again. |
| Questions fail with an Anthropic error | No Anthropic credit, or a wrong `ANTHROPIC_API_KEY`. |
| Errors mentioning Pinecone | Wrong `PINECONE_API_KEY`, or the free plan's index limit is reached — delete an unused index in the Pinecone console. |
| "That file is larger than 4 MB" | Vercel limits uploads to 4.5 MB per request. Split or compress the file. |
| A PDF shows **Failed: No extractable text** | It's a scanned image with no text layer. Use a text-based PDF. |
| First request after a while is slow | Normal for serverless cold starts (a second or two). |
| Too many `429 Too many requests` | Limits are 100 API requests/minute and 20 sign-in attempts per 15 minutes per IP. Wait and retry. |

---

## Free-plan notes

- **Vercel Hobby** is free for personal, non-commercial projects — a portfolio demo fits.
- **Neon** and **Pinecone** free plans are plenty for a demo; Neon's free databases suspend when idle and wake up automatically on the next request.
- **OpenAI and Anthropic** charge per use. With spending limits set, a demo costs cents.
