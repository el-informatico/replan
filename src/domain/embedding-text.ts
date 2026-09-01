/**
 * Corpus-text builder for semantic search (Phase 4, ADR-0006).
 *
 * Renders a Flight as the natural-language text that gets embedded into the
 * Convex vector index. The 16-tag controlled vocabulary
 * (docs/domain/flight-dataset.md:70-77) was designed for exactly this — tags
 * are included verbatim because they carry the semantic dimensions filters
 * can't express ("red-eye", "budget", "tight-connection").
 *
 * Pure and deterministic: no store, no clock, no side effects. Type-only
 * imports so a bare Node script (scripts/seed-semantic.ts, run under
 * --experimental-strip-types) can use it without a JSON-import loader.
 */

import type { Flight } from './flights.ts'

/** "2026-09-12T04:05:00-05:00" -> "04:05" (local wall-clock, per the offset). */
function localTime(iso: string): string {
  return iso.slice(11, 16)
}

/** Calendar-day shift between depart and arrive dates, in words. */
function dayShift(departIso: string, arriveIso: string): string {
  const d = departIso.slice(0, 10)
  const a = arriveIso.slice(0, 10)
  if (a === d) return 'same day'
  const days = Math.round(
    (Date.parse(`${a}T12:00:00Z`) - Date.parse(`${d}T12:00:00Z`)) / 86_400_000,
  )
  return days === 1 ? 'arriving next day' : `arriving ${days} days later`
}

export function flightToEmbeddingText(f: Flight): string {
  const airlines = [...new Set(f.segments.map((s) => s.airline_code))].join('+')
  const stopWord = f.stops === 0 ? 'nonstop' : `${f.stops}-stop`
  const parts: string[] = [
    `Flight ${f.id}: ${stopWord} from ${f.origin.city} (${f.origin.code}) to ` +
      `${f.destination.city} (${f.destination.code}) on ${airlines}`,
    `departs ${localTime(f.depart_iso)}`,
    `arrives ${localTime(f.arrive_iso)} ${dayShift(f.depart_iso, f.arrive_iso)}`,
  ]
  if (f.layovers.length > 0) {
    parts.push(
      `connections: ${f.layovers
        .map((l) => `${l.minutes}-minute layover in ${l.airport}`)
        .join(', ')}`,
    )
  }
  const hours = Math.floor(f.duration_minutes / 60)
  const minutes = f.duration_minutes % 60
  parts.push(`total duration ${hours}h ${minutes}m`)
  parts.push(`$${f.price_usd} ${f.cabin.replace('_', ' ')}`)
  parts.push(`${f.seats_left} seats left`)
  parts.push(f.refundable ? 'refundable' : 'non-refundable')
  parts.push(f.baggage_included ? 'baggage included' : 'no baggage included')
  if (f.tags.length > 0) parts.push(`tags: ${f.tags.join(', ')}`)
  return `${parts.join(', ')}.`
}

export interface EmbeddingRow {
  flight_id: string
  text: string
}

/** The full corpus for the one-time Convex seed. */
export function buildEmbeddingCorpus(flights: readonly Flight[]): EmbeddingRow[] {
  return flights.map((f) => ({ flight_id: f.id, text: flightToEmbeddingText(f) }))
}
