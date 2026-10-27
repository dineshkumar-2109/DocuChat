// Local / long-running Node server. (On Vercel, api/index.js is used instead.)
import { pathToFileURL } from "node:url";
import app from "./app.js";
import { config } from "./config/index.js";
import { pool } from "./db/pool.js";
import { drainIngestion } from "./lib/ingest.js";

/**
 * Start listening. Resolves with the server and a `stop()` that shuts down
 * gracefully: stop accepting requests, finish in-flight ingestion, close
 * the database pool. Also used by the test suite.
 */
export async function start() {
  const server = await new Promise((resolve) => {
    const s = app.listen(config.port, () => resolve(s));
  });
  console.log(`✓ DocuChat running on http://localhost:${server.address().port} (${config.env})`);

  let stopping;
  const stop = () =>
    (stopping ??= (async () => {
      await new Promise((resolve) => server.close(resolve));
      await drainIngestion();
      await pool.end().catch(() => {});
    })());

  return { server, stop };
}

// Entry point (`node src/server.js`).
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  start()
    .then(({ stop }) => {
      const onSignal = (signal) => {
        console.log(`${signal} received, shutting down…`);
        setTimeout(() => process.exit(1), 25_000).unref();
        stop().then(() => process.exit(0));
      };
      process.on("SIGTERM", onSignal);
      process.on("SIGINT", onSignal);
    })
    .catch((err) => {
      console.error("Failed to start:", err.message);
      process.exit(1);
    });
}
