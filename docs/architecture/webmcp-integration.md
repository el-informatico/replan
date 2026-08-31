# WebMCP Integration

How this site registers tools on `document.modelContext`. Factual API claims
below are cited to the spec (W3C Web Machine Learning CG draft, rev 41d12f0,
generated 2026-08-21 — https://webmachinelearning.github.io/webmcp/), Chrome
docs (https://developer.chrome.com/docs/ai/webmcp), and OpenAI's ChatGPT docs
(https://learn.chatgpt.com/docs/webmcp), verified 2026-08-31.

## API surface (as used here)

```ts
document.modelContext.registerTool(
  {
    name,          // required; [A-Za-z0-9_.-], 1–128 chars; duplicate name → InvalidStateError
    description,   // required, non-empty — this is what the agent reads to decide usage
    inputSchema,   // JSON Schema object (NOT a string); descriptive — the browser does NOT
                   // validate agent input against it (spec issue #92)
    execute,       // async (inputObject, { signal }) => any JSON-serializable value
    annotations?,  // { readOnlyHint?, untrustedContentHint? }
    title?,        // optional UI label
  },
  { signal?, exposedTo? },  // signal: AbortController — abort() unregisters
)
```

## Hard constraints

1. **`[SecureContext]`** — `document.modelContext` is `undefined` on plain
   HTTP. Production must be HTTPS (Vercel is); localhost also qualifies.
2. **Registration must run on every page load** — tools die with the document
   (spec "unloading document cleanup steps"). Static registration at module
   init is the default pattern; this is a single-page app, so no per-route
   re-registration is needed.
3. **No iframe tools** — ChatGPT's in-app browser ignores tools registered in
   iframes, even same-origin. Register in the top-level page only.
4. **Re-registering an existing name rejects** (`InvalidStateError`) — the
   registrar aborts the previous `AbortSignal` before re-registering.
5. **Return values must JSON-serialize.** Serialization failure surfaces to
   the caller as an opaque `UnknownError` — never return Blobs, streams, or
   circular structures.
6. **Errors are data, not rejections.** Granular error propagation is not
   implemented in the spec; a rejected `execute` reaches the agent opaquely.
   Chrome's best-practices doc: validate strictly in code, and return
   descriptive error text as a **successful** result so the model can
   self-correct and retry. We follow that convention: every tool returns
   `{ ok: true, ... }` or `{ ok: false, error: "...what went wrong and how to
   fix the input..." }`.

## Registration pattern in this repo

- `src/tools/webmcp.ts` — feature-detect + registrar. Checks
  `typeof document.modelContext?.registerTool === "function"` (OpenAI's own
  guard pattern); owns one `AbortController` per tool name so re-registration
  (HMR, re-mounts) aborts cleanly instead of throwing `InvalidStateError`.
  Returns a typed status the UI renders.
- `src/tools/ping.ts` — the Phase 0 smoke tool (see below).
- Later business tools follow the same shape: schema for the agent, strict
  validation in `execute`, `ok`/`error` envelope out.

## The `ping` smoke tool (Phase 0)

Proves discovery works end-to-end before any business logic exists:

- name: `ping`
- description: tells the agent exactly what it's for
- inputSchema: `{ type: "object", properties: { echo: { type: "string", ... } }, additionalProperties: false }`
- execute: returns `{ ok: true, pong: true, echo, received_at_utc }`

## Agent-side access paths

| Path | Notes |
|---|---|
| ChatGPT desktop in-app browser | WebMCP on by default; imperative API only; ChatGPT Work/Codex plans; GPT-5.6 Sol or Terra (Luna has WebMCP disabled) — https://learn.chatgpt.com/docs/webmcp |
| Chrome 149+ | `chrome://flags/#enable-webmcp-testing`, or origin-trial token |

## Stale-API warning

Pre-mid-2026 material shows `navigator.modelContext`, synchronous
`registerTool`, and `unregisterTool(name)` — all changed in the current spec.
Only trust `document.modelContext` sources.
