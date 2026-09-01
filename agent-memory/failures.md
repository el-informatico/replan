# Failures & root causes

Every failure that cost an iteration, with root cause. Feeds the eval
flywheel (regression tests in `evals/regression/`) and `lessons.md`.
Newest at the bottom. Format: `## FNNN — title`, numbered root causes each
ending in an evidence pointer, then a `Cost:` line stating iterations lost
and whether any wrong result was reported before capture.

## F001 — Local deploy smoke unreachable (loopback TCP blocked)
1. Root cause (environment): this assistant's shell calls cannot open TCP
   connections to 127.0.0.1 — `ss` shows the listener (e.g. `vite preview`
   on 127.0.0.1:4173) yet `curl` and raw `bash /dev/tcp/127.0.0.1/4173`
   time out; external HTTPS unaffected; persists with sandbox disabled.
   Evidence: 2026-08-31 session transcript (curl exit 28 / timeout).
2. Contributing: first smoke attempt also lacked a readiness wait and curl
   had no `--max-time` → a 5-minute command timeout instead of a fast fail.
Cost: two iterations; no wrong result reported (failures were loud). Outcome:
`verify.sh --url` used against the deployed URL only; readiness loops always
bounded (`--max-time`, capped iterations).

## F002 — Deployed URL served a login page, not the app (SSO protection)
1. Root cause: Vercel account has Deployment Protection — the deployment URL
   and the `replan-el-informatico.vercel.app` alias 302-redirect to
   `vercel.com/sso-api` → `/login`. `curl -L` followed to a 200 login page.
   Evidence: `curl -sIL` chain 2026-08-31.
2. Caught by: `verify.sh --url` marker check — "HTTP 200 but app shell
   marker missing". The smoke leg did its job against a wrong-looking-200.
3. Fix: use the public production alias `replan-phi.vercel.app`
   (HTTP 200, `<title>Replan…`, assets served). Optional dashboard change:
   disable Deployment Protection.
Cost: one iteration; no wrong result reported.

## F003 — Typecheck failure: redundant Promise<> wrapper on registerPing
1. Root cause: annotated `registerPing(): Promise<ReturnType<typeof
   registerTool>>` — but `registerTool` already returns a Promise, producing
   `Promise<Promise<T>>` vs the returned `Promise<T>`.
   Evidence: c3 first `verify.sh` run — `FAIL: typecheck`.
2. Fix: drop the annotation (`export function registerPing() { return
   registerTool(pingTool) }`) — rerun all legs PASS.
Cost: one iteration (the verify gate caught it before commit — working as
designed). Regression value: none beyond "let inference carry promise types."

## F004 — Calendar-rollover test over-asserted the error message
1. Root cause: the new test asserted the "calendar" message for month-13
   input, but Date.parse returns NaN there — rejected by the EARLIER
   format/NaN check with a different (still correct) message. Asserting
   specific message text for inputs that can fail at multiple validation
   layers is brittle.
   Evidence: p1c8 first verify run — 1 test failed; vitest output quoted the
   actual message.
2. Fix: scope the message assertion to true rollover inputs (Feb 30, Sep 31,
   hour 24); month-13 asserts ok:false only. Rerun green.
Cost: one verify iteration; no wrong result reported (fail-fast worked).

## F005 — (process) Reviewer found the cycle the test list named but no test covered
1. Root cause: T4's VERIFICATION list names "confirm after
   confirm-then-hold-again cycle" — the implementation failed exactly there
   (stray hold), and no test existed because the naming lived only in the
   plan, not as a test.
   Evidence: reviewer finding 1 (repro'd); fixed + tested in d0d9ab2.
2. Lesson promoted to lessons.md (L004): every cycle a contract's
   verification list names gets a test in the SAME increment that ships the
   code, not "later".
Cost: one post-review fix iteration inside p1c8; caught before deploy.

## F006 — (test-env) suite is not hermetic without .env.local (fresh-checkout gap; found in Phase 5, pre-existing)
1. Root cause: src/lib/semantic-client.test.ts stubs global fetch but
   still relies on the repo's gitignored .env.local providing
   VITE_CONVEX_SITE_URL; with no env file the client fails before the
   stub is reached, so 5 stubbed-path tests assert the wrong branch.
   The p4c8 "client tests are now hermetic" claim held only with
   .env.local present — p4c10's clean-build confirmation also ran with
   it, so the gap escaped.
   Evidence: worktree at 35abc5e (p5c1, docs-only) → 5 failures
   (non-JSON body / errors-as-data ok:false / network rejection /
   caller abort / 8s-timeout); identical 5 at 30c9daa (pre-Phase-5
   baseline); all 229 pass in both trees once .env.local is copied in.
2. Fix direction (NOT done — Phase 5 is demo-docs/tests only, and this
   is src/): give the suite its own endpoint in a beforeAll
   (setEndpointOverrideForTests or equivalent for import.meta.env) so
   no repo env is required; then verify a no-env worktree runs green.
   Implication until fixed: a fresh git clone (or CI without
   .env.local) fails verify.sh's unit leg.
Cost: none to product code; disclosed in p5c2 and left as an open item
for the next verify-gated increment.
