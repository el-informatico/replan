/**
 * Shared input validators for WebMCP tools.
 *
 * The browser does NOT validate agent input against inputSchema (spec issue
 * #92) — every tool validates here and returns errors as data so the agent
 * can self-correct (ADR-0003). These helpers keep that uniform across tools.
 */

import { ISO_WITH_OFFSET } from '../domain/flights.ts'

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string }

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function getString(
  rec: Record<string, unknown>,
  key: string,
): Validated<string> {
  const v = rec[key]
  if (v === undefined || v === null || v === '') {
    return { ok: false, error: `Missing required field "${key}" (${typeof v === 'string' ? 'empty string' : 'not provided'}).` }
  }
  if (typeof v !== 'string') {
    return { ok: false, error: `Field "${key}" must be a string, got ${typeof v}.` }
  }
  return { ok: true, value: v }
}

export function getOptionalString(
  rec: Record<string, unknown>,
  key: string,
): Validated<string | undefined> {
  const v = rec[key]
  if (v === undefined || v === null) return { ok: true, value: undefined }
  if (typeof v !== 'string') {
    return { ok: false, error: `Field "${key}" must be a string, got ${typeof v}.` }
  }
  return { ok: true, value: v }
}

export function getNumber(
  rec: Record<string, unknown>,
  key: string,
  opts: { required: boolean; min?: number; exclusiveMin?: number },
): Validated<number | undefined> {
  const v = rec[key]
  if (v === undefined || v === null) {
    if (opts.required) {
      return { ok: false, error: `Missing required field "${key}".` }
    }
    return { ok: true, value: undefined }
  }
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    return { ok: false, error: `Field "${key}" must be a finite number, got ${typeof v === 'number' ? String(v) : typeof v}.` }
  }
  if (opts.exclusiveMin !== undefined && v <= opts.exclusiveMin) {
    return { ok: false, error: `Field "${key}" must be greater than ${opts.exclusiveMin}, got ${v}.` }
  }
  if (opts.min !== undefined && v < opts.min) {
    return { ok: false, error: `Field "${key}" must be at least ${opts.min}, got ${v}.` }
  }
  return { ok: true, value: v }
}

/** ISO 8601 datetime that carries an explicit UTC offset. */
export function getIsoDatetime(
  rec: Record<string, unknown>,
  key: string,
  opts: { required: boolean },
): Validated<string | undefined> {
  const v = rec[key]
  if (v === undefined || v === null) {
    if (opts.required) {
      return { ok: false, error: `Missing required field "${key}".` }
    }
    return { ok: true, value: undefined }
  }
  if (typeof v !== 'string') {
    return { ok: false, error: `Field "${key}" must be an ISO 8601 datetime string, got ${typeof v}.` }
  }
  if (!ISO_WITH_OFFSET.test(v) || Number.isNaN(Date.parse(v))) {
    return {
      ok: false,
      error: `Field "${key}" must be an ISO 8601 datetime WITH explicit UTC offset, e.g. "2026-09-13T15:00:00-04:00" (got: ${JSON.stringify(v)}). Offsets matter: Lima is -05:00, Miami -04:00.`,
    }
  }
  // V8's Date.parse rolls impossible dates forward (2026-02-30 → Mar 2)
  // instead of returning NaN — reject them explicitly so a typo can't
  // silently widen a filter (reviewer finding 4).
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(v)
  if (parts) {
    const [, y, mo, d, h, mi, s] = parts
    const month = Number(mo)
    const day = Number(d)
    const daysInMonth = new Date(Date.UTC(Number(y), month, 0)).getUTCDate()
    if (
      month < 1 || month > 12 ||
      day < 1 || day > daysInMonth ||
      Number(h) > 23 || Number(mi) > 59 || Number(s) > 59
    ) {
      return {
        ok: false,
        error: `Field "${key}" is not a real calendar datetime: ${JSON.stringify(v)} (V8 would roll it forward — check day-of-month and time components).`,
      }
    }
  }
  return { ok: true, value: v }
}

export function unknownKeys(
  rec: Record<string, unknown>,
  allowed: readonly string[],
): string[] {
  return Object.keys(rec).filter((k) => !allowed.includes(k))
}
