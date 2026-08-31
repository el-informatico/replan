/**
 * ping — the Phase 0 WebMCP smoke tool.
 *
 * Its only job is to prove discovery + invocation end-to-end before any
 * business logic exists. Trivial schema, trivial return, errors-as-data
 * (docs/architecture/webmcp-integration.md).
 */

import { logToolCall, registerTool, type WebMcpTool } from './webmcp.ts'

export const pingTool: WebMcpTool = {
  name: 'ping',
  title: 'Ping (WebMCP smoke test)',
  description:
    'Connectivity smoke test for this page\'s agent tool channel. ' +
    'Takes no required arguments (optionally pass a short echo string) and ' +
    'returns { ok, pong, echo, received_at_utc }.',
  inputSchema: {
    type: 'object',
    properties: {
      echo: {
        type: 'string',
        description: 'Optional text (max 200 chars) echoed back in the response.',
      },
    },
    additionalProperties: false,
  },
  annotations: { readOnlyHint: true },
  execute: async (input) => {
    // Schema is descriptive, not enforced — validate here, return errors as data.
    const echoRaw = input['echo']
    if (echoRaw !== undefined && typeof echoRaw !== 'string') {
      return { ok: false, error: `Invalid input: "echo" must be a string, got ${typeof echoRaw}. Call with no arguments for a plain ping.` }
    }
    const echo = echoRaw === undefined ? null : echoRaw.slice(0, 200)
    const result = {
      ok: true,
      pong: true,
      echo,
      received_at_utc: new Date().toISOString(),
    }
    logToolCall({ tool: 'ping', at: result.received_at_utc, input, result })
    return result
  },
}

export function registerPing() {
  return registerTool(pingTool)
}
