import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";

// Semantic flight search (Phase 4, contract T11 / ADR-0006).
//
// Validated-live API facts this code relies on (Gate 1 preflight):
//   - ctx.vectorSearch is ACTIONS-only; hits are {_id, _score}.
//   - actions have no ctx.db -> hydration goes through an internalQuery.

const DIMENSIONS = 768;
const MODEL = "gemini-embedding-001";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

/** Error carrying the errors-as-data code the tool layer expects. */
class SemanticError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function embedQuery(query: string): Promise<number[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new SemanticError(
      "EMBEDDING_FAILED",
      "GEMINI_API_KEY is not configured on this Convex deployment " +
        "(set with: npx convex env set GEMINI_API_KEY <value>).",
    );
  }
  let res: Response;
  try {
    res = await fetch(`${GEMINI_BASE}/models/${MODEL}:embedContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        content: { parts: [{ text: query }] },
        taskType: "RETRIEVAL_QUERY",
        output_dimensionality: DIMENSIONS,
      }),
    });
  } catch (err) {
    throw new SemanticError(
      "EMBEDDING_FAILED",
      `Could not reach the embedding provider: ${String(err)}`,
    );
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new SemanticError(
      "EMBEDDING_FAILED",
      `Embedding provider returned HTTP ${res.status}: ${body.slice(0, 160)}. ` +
        "Retry, or rephrase and use search_flights with explicit filters.",
    );
  }
  const json = (await res.json()) as { embedding?: { values?: unknown } };
  const values = json?.embedding?.values;
  if (!Array.isArray(values) || values.length !== DIMENSIONS) {
    throw new SemanticError(
      "EMBEDDING_FAILED",
      `Embedding provider returned a malformed vector ` +
        `(expected ${DIMENSIONS} dims).`,
    );
  }
  return values as number[];
}

export const hydrateFlights = internalQuery({
  args: { hits: v.array(v.object({ id: v.id("flights"), score: v.number() })) },
  handler: async (ctx, args) => {
    const docs = await Promise.all(args.hits.map((h) => ctx.db.get(h.id)));
    return args.hits.map((h, i) => ({
      score: h.score,
      doc: docs[i] ? { flight_id: docs[i]!.flight_id, text: docs[i]!.text } : null,
    }));
  },
});

export const semanticSearch = internalAction({
  args: { query: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 8, 1), 16);
    const t0 = Date.now();
    const vector = await embedQuery(args.query);
    const embedMs = Date.now() - t0;

    const hits = await ctx.vectorSearch("flights", "by_embedding", {
      vector,
      limit,
    });
    const hydrated = await ctx.runQuery(internal.semantic.hydrateFlights, {
      hits: hits.map((h) => ({ id: h._id, score: h._score })),
    });
    return {
      ok: true as const,
      hits: hits.length,
      embed_ms: embedMs,
      results: hydrated.flatMap((r) =>
        r.doc
          ? {
              flight_id: r.doc.flight_id,
              text: r.doc.text,
              similarity_score: r.score,
            }
          : [],
      ),
    };
  },
});

// Reseed support: clear all rows so `npx convex import` can replace them.
// Internal by design — not exposed through http.ts.
export const clearFlights = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("flights").collect();
    await Promise.all(rows.map((doc) => ctx.db.delete(doc._id)));
    return { deleted: rows.length };
  },
});
