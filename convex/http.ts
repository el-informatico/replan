import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

// Public browser-facing endpoint (ADR-0006 §4): the SPA calls this with
// native fetch — zero new runtime deps. Unauthenticated by design (the
// deployment URL is public anyway); abuse is bounded by the free tier and
// every failure mode returns errors-as-data JSON, never a thrown page.
//
// Contract: POST /api/semantic-search  {"query": string, "limit"?: number}
//   -> 200 {ok: true,  hits, embed_ms, results: [{flight_id, text, similarity_score}]}
//   |  200 {ok: false, code: INVALID_INPUT | EMBEDDING_FAILED | SEMANTIC_SEARCH_UNAVAILABLE, error}
// (Always 200: the ok flag IS the transport of failure semantics for the
// tool layer; the client maps network-level faults to the same codes.)

const http = httpRouter();

const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

function respond(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...CORS_HEADERS, "content-type": "application/json" },
  });
}

http.route({
  path: "/api/semantic-search",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: CORS_HEADERS })),
});

http.route({
  path: "/api/semantic-search",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return respond({
        ok: false,
        code: "INVALID_INPUT",
        error: "Request body must be JSON: {\"query\": string}.",
      });
    }
    const record = (body ?? {}) as { query?: unknown; limit?: unknown };
    if (
      typeof record.query !== "string" ||
      record.query.trim().length === 0 ||
      record.query.length > 200
    ) {
      return respond({
        ok: false,
        code: "INVALID_INPUT",
        error: "Field \"query\" is required (string, 1-200 chars).",
      });
    }
    const limit =
      typeof record.limit === "number" && Number.isFinite(record.limit)
        ? record.limit
        : undefined;

    try {
      const result = await ctx.runAction(internal.semantic.semanticSearch, {
        query: record.query,
        limit,
      });
      return respond(result);
    } catch (err) {
      // SemanticError carries an errors-as-data code; anything else is a
      // transport/unknown failure.
      const carried = (err as { code?: unknown })?.code;
      const code =
        typeof carried === "string" && carried.length > 0
          ? carried
          : "SEMANTIC_SEARCH_UNAVAILABLE";
      return respond({
        ok: false,
        code,
        error:
          err instanceof Error
            ? err.message
            : `Semantic search failed: ${String(err)}`,
      });
    }
  }),
});

export default http;
