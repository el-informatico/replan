#!/usr/bin/env bash
# scripts/verify.sh — single verification entrypoint. This IS the Definition of Done.
#
# Legs: deps → typecheck → lint → build → unit → [deploy smoke if --url URL]
# Usage: scripts/verify.sh [--url <deployed-url>]
# Contract: docs/plans/phase0-execution-plan.md §4-5.
# Notes:
#   - set -uo pipefail (NOT -e): legs manage failure explicitly so one failing
#     leg reports and the run still summarizes all of them.
#   - exit 0 = all legs green; exit 1 = at least one leg failed.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

URL=""
if [ "${1:-}" = "--url" ]; then
  if [ -z "${2:-}" ]; then
    echo "verify.sh: --url requires a URL argument" >&2
    exit 2
  fi
  URL="$2"
elif [ $# -gt 0 ]; then
  echo "verify.sh: unknown argument(s): $* (usage: verify.sh [--url URL])" >&2
  exit 2
fi

fail=0
leg() { printf '\n=== %s ===\n' "$1"; }
run()  { printf '+ %s\n' "$*"; "$@"; }

# --- deps ---------------------------------------------------------------
leg "deps"
if [ ! -f package-lock.json ]; then
  echo "FAIL: no package-lock.json — run: npm install" >&2
  fail=1
elif [ -d node_modules ]; then
  echo "node_modules present — skipping npm ci"
else
  run npm ci || { echo "FAIL: npm ci"; fail=1; }
fi

# --- typecheck ------------------------------------------------------------
leg "typecheck (tsc -b)"
if run npx tsc -b; then echo "PASS: typecheck"; else echo "FAIL: typecheck"; fail=1; fi

# --- lint ------------------------------------------------------------------
leg "lint (oxlint)"
if run npx oxlint; then echo "PASS: lint"; else echo "FAIL: lint"; fail=1; fi

# --- build -----------------------------------------------------------------
leg "build (vite build)"
if run npx vite build; then echo "PASS: build"; else echo "FAIL: build"; fail=1; fi

# --- unit ------------------------------------------------------------------
leg "unit (vitest run)"
if run npx vitest run; then echo "PASS: unit"; else echo "FAIL: unit"; fail=1; fi

# --- deploy smoke (optional) ----------------------------------------------
if [ -n "$URL" ]; then
  leg "deploy smoke ($URL)"
  body="$(mktemp)"
  trap 'rm -f "$body"' EXIT
  code="$(curl -sS -L --max-time 30 -o "$body" -w '%{http_code}' "$URL" 2>/dev/null || echo 000)"
  if [ "$code" = "200" ]; then
    if grep -q '<div id="root"></div>' "$body" && grep -q 'src/main.tsx\|assets/index' "$body"; then
      echo "PASS: deploy smoke (HTTP $code, app shell present)"
    else
      echo "FAIL: deploy smoke (HTTP $code but app shell marker missing)" >&2
      fail=1
    fi
  else
    echo "FAIL: deploy smoke (HTTP status: $code)" >&2
    fail=1
  fi
fi

# --- summary ----------------------------------------------------------------
printf '\n'
if [ "$fail" -eq 0 ]; then
  echo "verify.sh: PASS (exit 0)"
  exit 0
else
  echo "verify.sh: FAIL (exit 1) — see legs above"
  exit 1
fi
