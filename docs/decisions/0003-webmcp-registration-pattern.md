# ADR-0003: WebMCP registration pattern — static registrar, errors-as-data, local types

- **Status:** Accepted
- **Date:** 2026-08-31
- **Ledger:** D003 in `agent-memory/decisions.md`

## Context

Phase 0 registers the first tool (`ping`) and every later tool goes through
the same code path, so the pattern chosen now is load-bearing for the whole
submission. WebMCP constraints that shape it (verified against the spec rev
41d12f0 and Chrome/OpenAI docs, 2026-08-31 — see
`docs/architecture/webmcp-integration.md`):

- Registration must happen on **every page load** (tools die with the document).
- There is **no `unregisterTool()`** — unregistration is `AbortSignal` abort,
  and re-registering an existing name **rejects** with `InvalidStateError`.
- The browser does **not** validate agent input against `inputSchema`;
  validation must live in `execute`.
- A rejected `execute` reaches the agent opaquely (`UnknownError`); error
  *text* returned as a successful result is readable and retryable.
- `document.modelContext` is `[SecureContext]`-gated and simply absent in
  non-WebMCP browsers.

## Decision

1. **One registrar module** (`src/tools/webmcp.ts`) owns every registration:
   feature-detect → abort previous per-name `AbortController` →
   `registerTool(tool, { signal })` → typed status for the UI. Tools are
   declared as data (`WebMcpTool` objects) and registered statically at app
   mount — no dynamic register/unregister around page state (Chrome
   best-practices guidance: keep static registration the default).
   Abort-before-reregister also makes React StrictMode double-mounts and
   Vite HMR safe instead of `InvalidStateError` crashes.
2. **Errors-as-data envelope.** Every tool returns
   `{ ok: true, …payload }` or `{ ok: false, error: "…what was wrong with the
   input and how to fix it…" }`. `execute` never rejects deliberately.
3. **Local minimal TS types** for `ModelContext`/tool dictionaries instead of
   depending on a third-party `webmcp-types` package: the API is young, we
   touch only `registerTool`, and a 15-line interface removes a supply-chain
   and version-drift risk during a 3-day challenge.
4. **Tool-call event log** (`logToolCall`/`subscribeToolLog`) in the registrar
   module: tools report their invocations, the UI subscribes and renders them
   live. This is the seed of the "UI reacts live to tool calls" requirement
   and later grows into booking-state rendering.

## Consequences

- Phase 1 tools (`search_flights`, holds, etc.) are added as one
  `WebMcpTool` object + one `registerX()` call in `App.tsx` — no new
  machinery.
- The UI can always show an honest per-tool status (`registered` /
  `unavailable` with the secure-context explanation / `error`), which doubles
  as in-page diagnostics when judging on browsers without WebMCP.
- If the spec gains `outputSchema` or a real error channel, the envelope can
   be revisited — the registrar is the single place to change.
