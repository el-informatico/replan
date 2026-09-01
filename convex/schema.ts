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
    // No uniqueIndex here: convex@1.45's table builder has no such method
    // (deploy rejected .uniqueIndex after .vectorIndex — TypeError, live).
    // Double-seed protection is layered instead: (1) `npx convex import`
    // REFUSES to import into an existing table without --append/--replace
    // (live-proven error: "Table flights already exists"); (2) the tool
    // dedupes flight_id after the similarity sort (semantic-search.ts).
    .index("by_flight_id", ["flight_id"]),
});
