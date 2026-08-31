import { beforeEach, describe, expect, it } from 'vitest'

import { getActiveHold, getSnapshot, resetForTests, setClockForTests, subscribe } from '../state/store.ts'
import { holdReservationTool } from './hold.ts'

const CALL = { signal: new AbortController().signal }

beforeEach(() => {
  resetForTests()
})

describe('hold_reservation — happy path', () => {
  it('creates a hold expiring exactly 15 minutes from now', async () => {
    const T0 = Date.parse('2026-09-12T12:00:00Z')
    setClockForTests(() => T0)
    const r = await holdReservationTool.execute({ flight_id: 'FL-001' }, CALL)
    expect(r['ok']).toBe(true)
    expect(r['flight_id']).toBe('FL-001')
    expect(r['ttl_minutes']).toBe(15)
    expect(r['hold_expires_at']).toBe('2026-09-12T12:15:00.000Z')
    expect(typeof r['note']).toBe('string')
  })

  it('store holds the active hold and notifies subscribers', async () => {
    let notified = 0
    const unsub = subscribe(() => {
      notified += 1
    })
    await holdReservationTool.execute({ flight_id: 'FL-003' }, CALL)
    unsub()
    expect(getActiveHold('FL-003')).not.toBeNull()
    expect(getSnapshot().holds).toHaveLength(1)
    expect(notified).toBeGreaterThan(0)
  })
})

describe('hold_reservation — state-dependent edges', () => {
  it('rejects an unknown flight_id with examples and count', async () => {
    const r = await holdReservationTool.execute({ flight_id: 'FL-999' }, CALL)
    expect(r['ok']).toBe(false)
    expect(r['error'] as string).toContain('FL-999')
    expect(r['error'] as string).toContain('FL-00')
    expect(r['error'] as string).toContain('26 flights')
  })

  it('rejects double-holding while the first hold is active', async () => {
    const T0 = Date.parse('2026-09-12T12:00:00Z')
    setClockForTests(() => T0)
    await holdReservationTool.execute({ flight_id: 'FL-001' }, CALL)
    const second = await holdReservationTool.execute({ flight_id: 'FL-001' }, CALL)
    expect(second['ok']).toBe(false)
    expect(second['error'] as string).toContain('already held')
    expect(second['error'] as string).toContain('2026-09-12T12:15:00.000Z')
    expect(getSnapshot().holds).toHaveLength(1)
  })

  it('allows holding again after the hold expires (lazy sweep)', async () => {
    let t = Date.parse('2026-09-12T12:00:00Z')
    setClockForTests(() => t)
    const first = await holdReservationTool.execute({ flight_id: 'FL-002' }, CALL)
    expect(first['ok']).toBe(true)

    t += 16 * 60_000 // 16 simulated minutes later
    expect(getActiveHold('FL-002')).toBeNull() // swept lazily

    const again = await holdReservationTool.execute({ flight_id: 'FL-002' }, CALL)
    expect(again['ok']).toBe(true)
    expect(again['hold_expires_at']).toBe('2026-09-12T12:31:00.000Z')
  })

  it('a different flight can be held concurrently (one hold per flight, not per traveler)', async () => {
    setClockForTests(() => Date.parse('2026-09-12T12:00:00Z'))
    await holdReservationTool.execute({ flight_id: 'FL-001' }, CALL)
    const other = await holdReservationTool.execute({ flight_id: 'FL-021' }, CALL)
    expect(other['ok']).toBe(true)
    expect(getSnapshot().holds).toHaveLength(2)
  })
})

describe('hold_reservation — malformed input', () => {
  it('rejects missing / non-string / empty flight_id and unknown fields', async () => {
    for (const bad of [{}, { flight_id: 7 }, { flight_id: '' }, { flight_id: 'FL-001', extra: 1 }]) {
      const r = await holdReservationTool.execute(bad as Record<string, unknown>, CALL)
      expect(r['ok']).toBe(false)
      expect(typeof r['error']).toBe('string')
    }
  })

  it('never throws — non-object input returns an error object', async () => {
    for (const bad of [null, 42, 'FL-001']) {
      const r = await holdReservationTool.execute(bad as unknown as Record<string, unknown>, CALL)
      expect(r['ok']).toBe(false)
      expect(typeof r['error']).toBe('string')
    }
  })
})
