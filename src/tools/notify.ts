/**
 * notify_contact — Contract T8 (docs/plans/phase2-execution-plan.md §3).
 * SIMULATED ONLY: nothing is transmitted — the tool composes and records
 * what would have been sent (hackathon scope; stated in the description
 * AND the return note). Minimal contact validation by design (no RFC
 * email/phone checks — the dispatch says don't over-engineer).
 */

import { addNotification, getSnapshot, nowIso } from '../state/store.ts'
import { getIsoDatetime, getOptionalString, isRecord, unknownKeys } from './validate.ts'
import { logToolCall, registerTool, type WebMcpTool } from './webmcp.ts'

export const notifyContactTool: WebMcpTool = {
  name: 'notify_contact',
  title: 'Notify a contact (simulated)',
  description:
    'Compose and "send" a heads-up about the new arrival to someone ' +
    'meeting the traveler. Input: { contact, new_arrival_time }. contact: ' +
    '{ name?, phone? | email?, relationship? } — at least one of phone or ' +
    'email is required (phone → sms, else email). SIMULATED: nothing is ' +
    'transmitted; the response shows exactly what would have been sent.',
  inputSchema: {
    type: 'object',
    properties: {
      contact: {
        type: 'object',
        description:
          'Recipient: { name?, phone? | email?, relationship? } — provide a ' +
          'phone (sms) or an email.',
        properties: {
          name: { type: 'string' },
          phone: { type: 'string' },
          email: { type: 'string' },
          relationship: { type: 'string' },
        },
        additionalProperties: false,
      },
      new_arrival_time: {
        type: 'string',
        description: 'The arrival time to announce. ISO 8601 with UTC offset.',
      },
    },
    required: ['contact', 'new_arrival_time'],
    additionalProperties: false,
  },
  execute: async (input) => {
    const result = await executeNotify(input)
    logToolCall({ tool: 'notify_contact', at: nowIso(), input, result })
    return result
  },
}

async function executeNotify(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!isRecord(input)) {
    return { ok: false, code: 'INVALID_INPUT', error: 'Input must be an object.' }
  }
  const extras = unknownKeys(input, ['contact', 'new_arrival_time'])
  if (extras.length > 0) {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      error: `Unknown field(s): ${extras.join(', ')}. Accepted: contact, new_arrival_time.`,
    }
  }

  const contactRaw = input['contact']
  if (!isRecord(contactRaw)) {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      error: 'Field "contact" must be an object: { name?, phone? | email?, relationship? }.',
    }
  }
  const contactExtras = unknownKeys(contactRaw, ['name', 'phone', 'email', 'relationship'])
  if (contactExtras.length > 0) {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      error: `Unknown contact field(s): ${contactExtras.join(', ')}. Accepted: name, phone, email, relationship.`,
    }
  }

  const fields: Record<'name' | 'phone' | 'email' | 'relationship', string | undefined> = {
    name: undefined,
    phone: undefined,
    email: undefined,
    relationship: undefined,
  }
  for (const key of ['name', 'phone', 'email', 'relationship'] as const) {
    const v = getOptionalString(contactRaw, key)
    if (!v.ok) return { ok: false, code: 'INVALID_INPUT', error: v.error }
    if (v.value === '') {
      return { ok: false, code: 'INVALID_INPUT', error: `contact.${key} must be a non-empty string.` }
    }
    fields[key] = v.value
  }

  if (fields.phone === undefined && fields.email === undefined) {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      error: 'contact needs a phone (sms) or an email (email) to reach them — got neither.',
    }
  }

  const arrival = getIsoDatetime(input, 'new_arrival_time', { required: true })
  if (!arrival.ok || arrival.value === undefined) {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      error: arrival.ok ? 'Field "new_arrival_time" is required.' : arrival.error,
    }
  }

  // Deterministic, JSON-serializable record of what would have been sent.
  const channel: 'sms' | 'email' = fields.phone !== undefined ? 'sms' : 'email'
  const target = fields.phone ?? fields.email ?? ''
  const notificationId = `NTF-${String(getSnapshot().notifications.length + 1).padStart(3, '0')}`
  const message = `Heads-up: the traveler's new arrival time is ${arrival.value}.`
  const sentAt = nowIso()

  addNotification({
    notificationId,
    channel,
    recipientName: fields.name ?? null,
    recipientTarget: target,
    message,
    arrivalTimeIso: arrival.value,
    sentAtIso: sentAt,
  })

  return {
    ok: true,
    simulated: true,
    notification_id: notificationId,
    channel,
    recipient: {
      ...(fields.name !== undefined ? { name: fields.name } : {}),
      ...(fields.relationship !== undefined ? { relationship: fields.relationship } : {}),
      target,
    },
    message,
    new_arrival_time: arrival.value,
    sent_at: sentAt,
    note: 'Simulated only — no real message was sent.',
  }
}

export function registerNotifyContact() {
  return registerTool(notifyContactTool)
}
