/**
 * One-time (re-runnable) Convex seed for semantic search — Phase 4, ADR-0006.
 *
 * Embeds all 26 flights with gemini-embedding-001 (RETRIEVAL_DOCUMENT,
 * 768 dims — must match convex/schema.ts) and writes convex-seed.jsonl for
 * `npx convex import --table flights`.
 *
 * Run (IMPORTANT: both CLI commands must target the PROD deployment —
 * either pass --prod or have .env.local's CONVEX_DEPLOYMENT select it;
 * reviewer finding 2 — run against dev by default, they would silently
 * clear/seed the wrong index):
 *   GEMINI_API_KEY=<key> npm run seed:semantic
 *   npx convex run semantic:clearFlights --prod   # when re-seeding non-empty
 *   npx convex import --table flights convex-seed.jsonl --prod
 *
 * The key is read from the environment ONLY (never committed; the runtime
 * copy lives in Convex env vars via `npx convex env set`).
 *
 * Node >= 22.6 with --experimental-strip-types (package.json script). The
 * only imports are node:fs and the pure src/domain builder (type-only
 * imports internally), so no TS loader is needed.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { flightToEmbeddingText } from "../src/domain/embedding-text.ts";
// Type-only import — stripped at runtime, so flights.ts's JSON import never
// loads under --experimental-strip-types.
import type { Flight } from "../src/domain/flights.ts";

const MODEL = "gemini-embedding-001";
const DIMENSIONS = 768;
const BASE = "https://generativelanguage.googleapis.com/v1beta";

const key = process.env.GEMINI_API_KEY;
if (!key) {
  console.error("GEMINI_API_KEY is not set — export it before seeding.");
  process.exit(1);
}

const dataset = JSON.parse(
  readFileSync(new URL("../src/data/flights.json", import.meta.url), "utf8"),
) as { flights: Flight[] };
const flights = dataset.flights;
const texts = flights.map((f) => flightToEmbeddingText(f));

const t0 = Date.now();
const res = await fetch(`${BASE}/models/${MODEL}:batchEmbedContents`, {
  method: "POST",
  headers: { "content-type": "application/json", "x-goog-api-key": key },
  body: JSON.stringify({
    requests: texts.map((text) => ({
      model: `models/${MODEL}`,
      content: { parts: [{ text }] },
      taskType: "RETRIEVAL_DOCUMENT",
      output_dimensionality: DIMENSIONS,
    })),
  }),
});
if (!res.ok) {
  console.error(`batchEmbedContents HTTP ${res.status}:`, (await res.text()).slice(0, 300));
  process.exit(1);
}
const json = (await res.json()) as {
  embeddings?: Array<{ values?: number[] }>;
};
const embeddings = json.embeddings ?? [];
if (embeddings.length !== flights.length) {
  console.error(`Expected ${flights.length} embeddings, got ${embeddings.length}.`);
  process.exit(1);
}

const rows = flights.map((f, i) => ({
  flight_id: f.id,
  text: texts[i],
  embedding: embeddings[i].values,
}));
const badDims = rows.filter((r) => !Array.isArray(r.embedding) || r.embedding.length !== DIMENSIONS);
if (badDims.length > 0) {
  console.error(`Malformed embeddings for: ${badDims.map((r) => r.flight_id).join(", ")}`);
  process.exit(1);
}

writeFileSync(
  new URL("../convex-seed.jsonl", import.meta.url),
  rows.map((r) => JSON.stringify(r)).join("\n") + "\n",
);

console.log(
  JSON.stringify(
    {
      rows: rows.length,
      dimensions: DIMENSIONS,
      elapsed_ms: Date.now() - t0,
      sample: rows[0].text.slice(0, 120) + "…",
      next: "npx convex import --table flights convex-seed.jsonl --prod",
    },
    null,
    2,
  ),
);
