/**
 * WebMCP registrar + tool-call event log.
 *
 * Minimal local typings for the imperative WebMCP API
 * (https://webmachinelearning.github.io/webmcp/, rev 41d12f0). Deliberately
 * local — see docs/decisions/0003-webmcp-registration-pattern.md — because the
 * API is young and 15 lines of interface beat a dependency on a fast-moving
 * typing package.
 *
 * Constraints encoded here (docs/architecture/webmcp-integration.md):
 * - [SecureContext]: document.modelContext is undefined on plain HTTP —
 *   feature-detect, never assume.
 * - Re-registering an existing name rejects with InvalidStateError — abort the
 *   previous per-tool AbortController first (also makes React StrictMode
 *   double-mounts and Vite HMR safe).
 * - Registration must run on every page load (tools die with the document).
 */

export interface ToolAnnotations {
  readOnlyHint?: boolean
  untrustedContentHint?: boolean
}

export interface ToolExecuteOptions {
  signal: AbortSignal
}

export type ToolResult = Record<string, unknown>

export interface WebMcpTool {
  /** [A-Za-z0-9_.-], 1–128 chars, unique per document */
  name: string
  /** Optional UI label */
  title?: string
  /** What the agent reads to decide whether/how to call the tool */
  description: string
  /** JSON Schema object (NOT a string). Descriptive only — validate in execute. */
  inputSchema: Record<string, unknown>
  annotations?: ToolAnnotations
  execute: (input: Record<string, unknown>, options: ToolExecuteOptions) => Promise<ToolResult>
}

export interface ModelContextLike {
  registerTool(tool: WebMcpTool, options?: { signal?: AbortSignal }): Promise<undefined>
}

export function getModelContext(): ModelContextLike | undefined {
  if (typeof document === 'undefined') return undefined
  const mc = (document as Document & { modelContext?: ModelContextLike }).modelContext
  return typeof mc?.registerTool === 'function' ? mc : undefined
}

export type ToolRegistrationStatus =
  | { tool: string; status: 'registered' }
  | { tool: string; status: 'unavailable'; detail: string }
  | { tool: string; status: 'error'; detail: string }

const controllers = new Map<string, AbortController>()

export async function registerTool(tool: WebMcpTool): Promise<ToolRegistrationStatus> {
  const mc = getModelContext()
  if (!mc) {
    return {
      tool: tool.name,
      status: 'unavailable',
      detail: 'document.modelContext is not available — WebMCP requires a secure context (HTTPS or localhost) and a WebMCP-enabled browser (ChatGPT in-app browser, or Chrome 149+ with chrome://flags/#enable-webmcp-testing).',
    }
  }
  // No unregisterTool() in the spec: aborting the signal unregisters, and it
  // also prevents InvalidStateError on same-name re-registration.
  controllers.get(tool.name)?.abort()
  const controller = new AbortController()
  controllers.set(tool.name, controller)
  try {
    await mc.registerTool(tool, { signal: controller.signal })
    return { tool: tool.name, status: 'registered' }
  } catch (err) {
    return { tool: tool.name, status: 'error', detail: String(err) }
  }
}

// --- tool-call event log (what makes the UI react live to agent activity) ---

export interface ToolLogEntry {
  tool: string
  at: string
  input: Record<string, unknown>
  result: ToolResult
}

type Listener = (entry: ToolLogEntry) => void
const listeners = new Set<Listener>()

export function logToolCall(entry: ToolLogEntry): void {
  for (const l of listeners) l(entry)
}

export function subscribeToolLog(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
