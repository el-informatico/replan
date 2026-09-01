import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Derived vector index over the static dataset (ADR-0006): flights.json stays
// the source of truth; these rows are {flight_id, text, embedding} seeded by
// scripts/seed-semantic.ts. 768 = gemini-embedding-001 output_dimensionality.
export default defineSchema({
  flights: defineTable({
    flight_id: v.string(),
    text: v.string(),
    embedding: v.optional(v.array(v.float64())),
  })
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 768,
    })
    // uniqueIndex (reviewer finding 1): a re-import without clearFlights
    // must FAIL LOUDLY here, not silently double every row in search
    // results.
    .uniqueIndex("by_flight_id", ["flight_id"]),
});
