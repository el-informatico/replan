import { beforeEach, describe, expect, it } from 'vitest'

import { getSnapshot, resetForTests, setClockForTests, subscribe } from '../state/store.ts'
import { notifyContactTool } from './notify.ts'

const CALL = { signal: new AbortController().signal }

beforeEach(() => {
  resetForTests()
})

describe('notify_contact — happy path (simulated)', () => {
  it('returns a structured sms confirmation and records it', async () => {
    const T0 = Date.parse('2026-09-12T12:00:00Z')
    setClockForTests(() => T0)
    const r = await notifyContactTool.execute(
      {
        contact: { name: 'María', phone: '+51 987 654 321', relationship: 'sister' },
        new_arrival_time: '2026-09-13T06:05:00-04:00',
      },
      CALL,
    )
    expect(r['ok']).toBe(true)
    expect(r['simulated']).toBe(true)
    expect(r['notification_id']).toBe('NTF-001')
    expect(r['channel']).toBe('sms')
    expect(r['recipient']).toEqual({
      name: 'María',
      relationship: 'sister',
      target: '+51 987 654 321',
    })
    expect(r['message'] as string).toContain('2026-09-13T06:05:00-04:00')
    expect(r['sent_at']).toBe('2026-09-12T12:00:00.000Z')
    expect(r['note'] as string).toContain('Simulated')
    expect(getSnapshot().notifications).toHaveLength(1)
  })

  it('falls back to email when only an email is given', async () => {
    const r = await notifyContactTool.execute(
      { contact: { email: 'cousin@example.com' }, new_arrival_time: '2026-09-13T06:05:00-04:00' },
      CALL,
    )
    expect(r['ok']).toBe(true)
    expect(r['channel']).toBe('email')
    expect(r['recipient']).toEqual({ target: 'cousin@example.com' })
  })

  it('assigns sequential ids and notifies subscribers per send', async () => {
    let notified = 0
    const unsub = subscribe(() => {
      notified += 1
    })
    const first = await notifyContactTool.execute(
      { contact: { phone: '+1 305 555 0100' }, new_arrival_time: '2026-09-13T06:05:00-04:00' },
      CALL,
    )
    const second = await notifyContactTool.execute(
      { contact: { email: 'a@b.co' }, new_arrival_time: '2026-09-13T06:05:00-04:00' },
      CALL,
    )
    unsub()
    expect(first['notification_id']).toBe('NTF-001')
    expect(second['notification_id']).toBe('NTF-002')
    expect(notified).toBeGreaterThanOrEqual(2)
    expect(getSnapshot().notifications.map((n) => n.notificationId)).toEqual(['NTF-001', 'NTF-002'])
  })
})

describe('notify_contact — malformed input (errors as data)', () => {
  it('requires at least one of phone / email', async () => {
    const r = await notifyContactTool.execute(
      { contact: { name: 'María' }, new_arrival_time: '2026-09-13T06:05:00-04:00' },
      CALL,
    )
    expect(r['ok']).toBe(false)
    expect(r['code']).toBe('INVALID_INPUT')
    expect(r['error'] as string).toContain('phone')
    expect(r['error'] as string).toContain('email')
  })

  it('rejects unknown contact keys and unknown top-level keys', async () => {
    const badContact = await notifyContactTool.execute(
      { contact: { phone: '+1 305 555 0100', fax: 'no' }, new_arrival_time: '2026-09-13T06:05:00-04:00' },
      CALL,
    )
    expect(badContact['ok']).toBe(false)
    expect(badContact['error'] as string).toContain('fax')
    const badTop = await notifyContactTool.execute(
      { contact: { phone: 'x' }, new_arrival_time: '2026-09-13T06:05:00-04:00', urgent: true },
      CALL,
    )
    expect(badTop['ok']).toBe(false)
  })

  it('rejects empty strings and non-string contact fields (null counts as absent)', async () => {
    for (const contact of [
      { name: '', phone: '+1 305 555 0100' },
      { phone: '' },
      { email: '' },
      { phone: 42 },
    ]) {
      const r = await notifyContactTool.execute(
        { contact, new_arrival_time: '2026-09-13T06:05:00-04:00' } as Record<string, unknown>,
        CALL,
      )
      expect(r['ok']).toBe(false)
      expect(typeof r['error']).toBe('string')
    }
  })

  it('rejects a non-object contact', async () => {
    for (const contact of ['María', 42, [], null]) {
      const r = await notifyContactTool.execute(
        { contact, new_arrival_time: '2026-09-13T06:05:00-04:00' } as Record<string, unknown>,
        CALL,
      )
      expect(r['ok']).toBe(false)
      expect(r['error'] as string).toContain('contact')
    }
  })

  it('rejects missing / malformed / impossible-calendar arrival times', async () => {
    for (const new_arrival_time of [undefined, 'not-a-date', '2026-09-13T06:05:00', '2026-02-30T06:05:00-04:00']) {
      const r = await notifyContactTool.execute(
        { contact: { phone: '+1 305 555 0100' }, new_arrival_time } as Record<string, unknown>,
        CALL,
      )
      expect(r['ok']).toBe(false)
      expect(r['code']).toBe('INVALID_INPUT')
    }
  })

  it('treats explicit nulls inside contact as absent (validator convention)', async () => {
    const r = await notifyContactTool.execute(
      {
        contact: { name: null, email: 'a@b.co', relationship: null },
        new_arrival_time: '2026-09-13T06:05:00-04:00',
      } as Record<string, unknown>,
      CALL,
    )
    expect(r['ok']).toBe(true)
    expect(r['channel']).toBe('email')
    expect(r['recipient']).toEqual({ target: 'a@b.co' })
  })

  it('never throws — non-object input returns an error object', async () => {
    for (const bad of [null, 42, 'x', []]) {
      const r = await notifyContactTool.execute(bad as unknown as Record<string, unknown>, CALL)
      expect(r['ok']).toBe(false)
      expect(typeof r['error']).toBe('string')
    }
  })
})
