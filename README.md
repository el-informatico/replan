# Replan — Agentic Travel Recovery

A [WebMCP Challenge](https://webmcp.devpost.com/) submission: a simulated
flight-booking site for a Lima→Miami cancellation scenario, built to be
operated by an AI agent (ChatGPT's in-app browser) through
[`document.modelContext.registerTool()`](https://webmachinelearning.github.io/webmcp/)
tools — not through screen-scraping a human UI.

**No custom LLM, NLU, or voice layer.** The site exposes well-typed browser
tools; the agent discovers and calls them by natural language; the UI reacts
live to each invocation.

## Status

Phase 0 (foundation): repo + toolchain + synthetic flight dataset + `ping`
smoke tool proving WebMCP discovery end-to-end. Flight/hotel/transport
business tools arrive in later phases — see `agent-memory/current.md`.

## Run locally

```bash
npm ci
npm run dev        # http://localhost:5173 — localhost is a secure context,
                   # so document.modelContext works in WebMCP-enabled browsers
```

To see the tools: open the dev URL (or the deployed URL below) in Chrome 149+
with `chrome://flags/#enable-webmcp-testing` enabled, or in ChatGPT's in-app
browser, and ask the agent what tools the page provides.

## Verify

```bash
scripts/verify.sh              # typecheck + lint + build + unit tests
scripts/verify.sh --url URL    # … plus a deploy smoke test
```

## Deployed

Production (public, no auth): **https://replan-phi.vercel.app**

## License

[MIT](./LICENSE)
