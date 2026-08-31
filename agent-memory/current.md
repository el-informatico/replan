# Current work

**PHASE 0 (Foundation) COMPLETE — 2026-08-31.** All six acceptance criteria
carry evidence (see `progress.md`); three follow-ups remain open, listed below.

## What Phase 0 delivered

- Agent-legible repo (CLAUDE.md index, docs/{architecture,decisions,domain,
  plans}, agent-memory, evals/{functional,regression,e2e,held_out},
  scripts/verify.sh) — omissions justified in ADR-0002.
- Stack: Vite 8 + TS 6 strict + React 19 + oxlint + Vitest 4 (ADR-0001);
  static client-side build, no server runtime.
- Synthetic dataset: 26 flights, LIM→MIA cancellation scenario, invariant-
  validated (`src/domain/flights.ts` + tests); schema in
  `docs/domain/flight-dataset.md`.
- WebMCP foundation: single registrar (`src/tools/webmcp.ts`) + `ping` smoke
  tool (`src/tools/ping.ts`) + UI showing registration status and a live
  tool-call log (ADR-0003).
- Deployed: **https://replan-phi.vercel.app** (Vercel production, public).
  `scripts/verify.sh --url https://replan-phi.vercel.app` → exit 0.

## What Phase 1 (flight-tool task contracts) should assume

1. The registrar in `src/tools/webmcp.ts` is THE path for new tools: declare a
   `WebMcpTool` object, add a `registerX()`, call it in `App.tsx`'s effect.
   Abort-before-reregister, feature-detection, and status typing already work.
2. Errors-as-data is the contract: every tool returns `{ ok: true, … }` or
   `{ ok: false, error }` — never rejects deliberately (ADR-0003).
3. Dataset loading: `loadDataset()` from `src/domain/flights.ts`; filter
   fields are `destination.code`, `arrive_iso` (explicit offsets — compare
   parsed instants, never strings), `price_usd`, `total_layover_minutes`.
   Scenario defaults (deadline/airports/price/layover) live in
   `scenario.constraints_hint`.
4. Any dataset edit must keep `validateDataset()` at zero violations;
   `verify.sh` gates this.
5. Deploy = `vercel deploy --prod --yes --token "$(cat ~/.vercel-token)"`;
   verify with `scripts/verify.sh --url https://replan-phi.vercel.app`.
6. `verify.sh` legs: deps → typecheck → lint → build → unit → optional
   `--url` smoke. Commit only on exit 0.
7. Commit messages in this repo carry NO AI co-author trailers (user rule,
   2026-08-31; disclosure lives in the GitHub README).

## Open items (user-involved / follow-up)

1. **GitHub repo — BLOCKING for submission, not for Phase 0 code.** No remote
   exists. Challenge requires a public repo; criterion 6 (MIT license visible
   in GitHub About sidebar) can only be verified once pushed. User creates
   repo + pushes (or installs/auths `gh`). After push: visually confirm the
   license renders in the About section.
2. **Manual WebMCP discovery check of `ping`** — this session is headless
   WSL2 with no WebMCP-capable browser, so BOTH check paths are user-manual:
   - ChatGPT desktop in-app browser (WebMCP on by default; needs ChatGPT
     Work/Codex plan + GPT-5.6 Sol or Terra — Luna has WebMCP disabled per
     https://learn.chatgpt.com/docs/webmcp): open
     https://replan-phi.vercel.app, ask the agent what tools the page
     provides and to call `ping`.
   - Chrome 149+ with `chrome://flags/#enable-webmcp-testing` enabled: open
     the URL, then use the agent side panel, or the "Model Context Tool
     Inspector" extension (github.com/beaufortfrancois/model-context-tool-
     inspector) to list tools and execute `ping` with `{}`.
   - Expected result: tool `ping` listed; calling it returns
     `{ ok: true, pong: true, echo: null, received_at_utc: … }`; the page's
     tool-call log renders the invocation live. Record outcome here.
   Note: this session's evidence covers registration code correctness (typed,
   tested, verified in the served bundle) but NOT live agent discovery.
3. **Vercel deployment protection**: deployment URLs and the
   `replan-el-informatico.vercel.app` alias SSO-redirect to vercel.com login;
   only `replan-phi.vercel.app` is public. Fine for judging (hand judges the
   public URL), but optionally disable Deployment Protection in the Vercel
   dashboard to make every URL public.
4. (User) Add the AI-use disclosure to the GitHub README after push.

## Session environment notes (carry forward)

- Loopback TCP is blocked for this assistant's shell calls (servers visible
  in `ss` but unreachable; external HTTPS fine) — local `vite preview` smoke
  tests are impossible; use the deployed URL.
- Never `pkill -f` with a pattern that appears in the invoking command line —
  it matches (and kills) the invoking shell itself. Use `fuser -k PORT/tcp`.
- `vercel login` inside WSL cannot complete the OAuth callback on this
  machine (mirrored networking + Hyper-V firewall blocks the loopback). Token
  auth via `~/.vercel-token` (0600) is the working path. Vercel CLI ≥47.2.2
  required (installed 59.10.0 globally).
