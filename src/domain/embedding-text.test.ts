import { beforeEach, describe, expect, it } from 'vitest'
import { loadDataset } from './flights.ts'
import { buildEmbeddingCorpus, flightToEmbeddingText } from './embedding-text.ts'

beforeEach(() => {
  // pure module — nothing to reset; kept for convention parity
})

describe('corpus-text builder — dataset invariants (all 26 flights)', () => {
  const dataset = loadDataset()

  it('produces a non-empty single-line text for every flight', () => {
    for (const f of dataset.flights) {
      const text = flightToEmbeddingText(f)
      expect(text.length).toBeGreaterThan(60)
      expect(text.length).toBeLessThan(500)
      expect(text).not.toMatch(/\n/)
      expect(text.endsWith('.')).toBe(true)
    }
  })

  it('carries the retrievable facts: id, airports, price, times, tags', () => {
    for (const f of dataset.flights) {
      const text = flightToEmbeddingText(f)
      expect(text).toContain(f.id)
      expect(text).toContain(f.origin.code)
      expect(text).toContain(f.destination.code)
      expect(text).toContain(`$${f.price_usd}`)
      expect(text).toContain(f.depart_iso.slice(11, 16))
      expect(text).toContain(f.arrive_iso.slice(11, 16))
      for (const tag of f.tags) expect(text).toContain(tag)
    }
  })

  it('is deterministic', () => {
    for (const f of dataset.flights) {
      expect(flightToEmbeddingText(f)).toBe(flightToEmbeddingText(f))
    }
  })

  it('corpus rows are 1:1 with the dataset and unique by flight_id', () => {
    const corpus = buildEmbeddingCorpus(dataset.flights)
    expect(corpus).toHaveLength(dataset.flights.length)
    expect(new Set(corpus.map((r) => r.flight_id)).size).toBe(corpus.length)
  })
})

describe('corpus-text builder — discriminating phrasing', () => {
  const flights = loadDataset().flights

  it('red-eye flights carry the tag and read as overnight', () => {
    const redEyes = flights.filter((f) => f.tags.includes('red-eye'))
    expect(redEyes.length).toBeGreaterThan(0)
    for (const f of redEyes) {
      const text = flightToEmbeddingText(f)
      expect(text).toContain('red-eye')
      const crossesMidnight = f.depart_iso.slice(0, 10) !== f.arrive_iso.slice(0, 10)
      if (crossesMidnight) {
        expect(text).toContain('arriving next day')
      } else {
        // after-midnight departures (FL-004 departs 01:15, FL-022 01:50) —
        // the overnight character is in the departure hour + the tag
        const departHour = Number(f.depart_iso.slice(11, 13))
        expect(departHour).toBeLessThanOrEqual(5)
      }
    }
  })

  it('one-stop flights name their layover airports and minutes', () => {
    const oneStop = flights.filter((f) => f.stops === 1)
    expect(oneStop.length).toBeGreaterThan(0)
    for (const f of oneStop) {
      const text = flightToEmbeddingText(f)
      expect(text).toContain('1-stop')
      expect(text).toContain(`${f.layovers[0].minutes}-minute layover in ${f.layovers[0].airport}`)
    }
  })

  it('nonstop flights contain no layover phrase', () => {
    for (const f of flights.filter((x) => x.stops === 0)) {
      expect(flightToEmbeddingText(f)).not.toContain('layover in')
    }
  })
})
