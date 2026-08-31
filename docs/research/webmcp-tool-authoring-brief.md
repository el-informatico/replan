# WebMCP tool-authoring brief (for search_flights / hold_reservation / update_constraints / confirm_booking)

Researched 2026-08-31. Sources: Chrome docs (best-practices, build-tools, evals, imperative-api, secure-tools, hub), W3C CG spec, webmachinelearning explainer, ChatGPT "Site tools" doc, vercel/shop PR #498, GoogleChromeLabs/webmcp-tools (react-flightsearch demo + travel evals).

## 1. Tool `description` — what good looks like

**Rules (Chrome best-practices, https://developer.chrome.com/docs/ai/webmcp/best-practices):**

> "A clear description should describe what the tool does and when to use it. Rely on positive language and preferences instead of negative language, such as limitations."

> Don't: "Don't use this tool for weather."
> Do: "This tool can create a calendar event, scheduled for a specific date and time."

> "Limitations should be implicit in a well-written description."

Also: "Trust the agent to complete the task. Instead of writing rigid or negative instructions, assume the agent is able to understand what is required."

**Budgets (Chrome tool-security, https://developer.chrome.com/docs/ai/webmcp/secure-tools):**

> "To avoid running into agent guardrails, write succinct tool descriptions and outputs. We recommend the following character limits for better results: 500 characters per tool description; 150 characters per parameter description; 30 characters per tool name and parameter name; 1.5K character limit per individual tool output."

> "It's likely that there is some variation across agents, and you may want to adjust your character budgets with user feedback."

**Verbatim good descriptions from official sources** (all <=200 chars, verb-first, what+when+returns+chaining):

- Chrome Imperative API (https://developer.chrome.com/docs/ai/webmcp/imperative-api):
  - `'Control pizza layers (sauce, cheese). Use "add", "remove", or "toggle".'` (embeds the enum values in prose)
  - `'Search orders in a given timeframe. Returns order number, shipping status and location'` (describes the return shape)
- vercel/shop PR #498 (https://github.com/vercel/shop/pull/498):
  - `"Search this store's catalog. Use a returned handle with shop.get_product_options."` (names the next tool in the chain)
  - `"List option name and value pairs for a product. Use nextOptionOffset to continue."` (teaches pagination)
  - `"Read a redacted page of the guest cart. Use variantId to verify an uncertain add."`
  - `"Add one available variant to the guest cart and open the cart for review."` (states the side effect on the UI)
- GoogleChromeLabs travel eval schema (https://github.com/GoogleChromeLabs/webmcp-tools, webmcp-evals/examples/travel/schema.json) — the "when-to-use" pattern, closest to your domain:
  - `"Advanced filter tool to narrow down flight results. Use this whenever the user specifies airlines, price limits, number of stops, or specific origin / destination airports like JFK or Newark."`
  - `"Lists all flights available in the current search results, regardless of filters."`
  - `"Searches for flights with the given parameters."`
- ChatGPT example (https://learn.chatgpt.com/docs/webmcp): `"Read the title of the current page."`
- Explainer (https://github.com/webmachinelearning/webmcp): `"Filters the list of templates based on a natural language visual description."`, `"Returns an array of product listings containing id, description, price, and photo."`

**Pattern to copy:** one or two sentences = [verb: what it does] + [when to use / trigger conditions] + [what it returns, if data] + [which tool/value feeds the next step]. Positive framing only; no "don't use for X". Keep under 500 chars (aim ~150-250).

Naming (best-practices): "distinguish execution from initiation, and use verbs that describe exactly what happens. For example, `create-event` is a tool for immediate event creation, but `start-event-creation-process` is a tool that redirects the user to a form." Your `hold_reservation` vs `confirm_booking` split matches this; make `confirm_booking`'s description state plainly that it finalizes/commits the booking (see the spec's `finalizeCart` warning in §4 below).

## 2. inputSchema conventions

Official examples (Chrome imperative-api, GoogleLabs demo, Vercel PR) consistently do:
- `type: "object"` + `properties` + `required` array. Evals doc lists as a failure-check: "Are all required parameters explicitly marked and checked?"
- **enum for closed sets** — Chrome's own examples: `action: { type: 'string', enum: ['add', 'remove', 'toggle'] }`, `priority: { enum: ['high', 'low', 'auto'] }`, `tripType: { enum: ["one-way", "round-trip"] }`. Evals troubleshooting: "Is the `inputSchema` clearly defined, including `enum` values and a good `description` for each property?"
- **`description` on every property** — Evals: "Does the argument's description explicitly guide the LLM on how to map user input to the expected structured data (such as a specific ID or format)?" Put format + example in the property description, e.g. GoogleLabs flight demo:
  ```
  origin: { type: "string",
    description: "City or airport IATA code for the origin. Prefer city IATA codes when a specific airport is not provided. Example: 'RIO' for 'Rio de Janeiro'",
    pattern: "^[A-Z]{3}$", minLength: 3, maxLength: 3 }
  ```
- **Free string only when genuinely open** (`query`, `text`), and then bounded (`minLength`/`maxLength` — Vercel caps query at 120 chars).
- **Defaults** used by official examples: explainer `pageSize: { enum: ["Letter","Legal","A4"], default: "Letter" }`; Vercel `quantity: { default: 1 }`, `optionOffset: { default: 0 }`.
- **Nesting**: shallow. Deepest official nesting is 2 levels — Vercel `selectedOptions.items` (object inside array), GoogleLabs eval schema `departureTime: { min, max }`. No example goes deeper.
- **`additionalProperties: false`**: used by Vercel (every schema, incl. nested items) and the ChatGPT sample; **omitted** by all Chrome/GoogleLabs examples. No doc mandates it.

Key best-practices text on schema philosophy:

> "Validate strictly in code, loosely in schema. Constraints and testing should be used for functions and code that have binary logic. While schema constraints can be helpful, they're not guaranteed. Add descriptive errors to your function code to allow the model to self-correct and retry with new, valid parameters."

> "Accept raw user input. Avoid asking the agent to perform math or transform the input strings. For example, if a user says, '11:00 to 15:00,' the tool should accept this as a string."

> "Declare specific types for parameters, such as string, number, or enum."

> "Explain why you've made certain choices. … declare shipping type with natural language instead of using an ambiguous ID: `shipping="Express"` instead of `shipping_id=1`."

Tension to know: best-practices prefers natural-language values, but the flight demos use IATA codes + `pattern` + a description that explains the mapping ("Example: 'RIO' for 'Rio de Janeiro'"), and their evals reward "Heathrow"→LHR / "O'Hare"→ORD mapping. If you use codes, say so in the property description. Vercel's alternative for opaque IDs: describe them as only obtainable from a prior tool ("A product handle returned by shop.search_products").

Conditional requirement handled via description (GoogleLabs eval schema): `inboundDate` not in `required`, described as "Required round-trip journeys."

Times: the shipped flight demo encodes time windows as minutes-from-midnight (`[540, 1020]`, with a worked example in the description); the eval-schema variant uses `departureTime: { min: "09:00", max: "17:00" }` with `pattern: "^[0-9]{2}:[0-9]{2}$"`. Prefer the HH:MM string form — it satisfies "accept raw user input".

Enum-with-titles trick from Chrome's `get_order_status` example: `enum` plus `oneOf: [{const, title}]` pairs to give display titles to code values.

## 3. Return-value shape

- The spec serializes whatever `execute` resolves to: "Let serializedResult be the result of serializing a JavaScript value to a JSON string given v." The agent side gets that string. Plain JSON values are the norm.
- Official examples return **plain strings for confirmations** (`'Added to-do: Buy milk'`, GoogleLabs: `"Filters successfully updated."`, `"A new flight search was started."`) and **plain objects/arrays for data** (ChatGPT example `({ title: document.title })`; GoogleLabs `listFlights` returns `Array<Flight>`).
- **MCP content blocks appear once**, in the webmachinelearning explainer's `add-todo` example (`return { content: [{ type: "text", text: ... }] }`), and nowhere in Chrome's docs. The spec explicitly declines to prescribe a format and notes only two annotations exist. Treat content blocks as legacy/optional — plain values are what every Chrome, Vercel, and GoogleLabs example uses.
- **How much data**: Evals doc troubleshooting checklist — "Is the output overly verbose? Does it contain only the minimum essential information the LLM needs for the next action?" and "If the output is used by the LLM for subsequent calls, is the output formatted clearly for LLM ingestion?" Security page: 1.5K chars per tool output.
- **Pagination/truncation — Vercel's pattern (the most engineered public example)**: `MAX_OUTPUT_CHARACTERS = 1_450`; a `fitItemsToOutputBudget()` helper that adds items until the serialized size would exceed budget; responses carry continuation tokens and counts (`nextCursor`, `nextOptionOffset`, `optionValueCount`, `nextLineOffset`, `moreLinesMayExist: boolean`, `empty`); long text fields truncated per-field (`title` → 80 chars, `variantTitle` → 48). Every list-like result is "a page", never the whole list.
- ChatGPT: "return enough information to verify the result" — i.e. return the confirmation facts, not just "ok".
- best-practices: "Update the interface state after functions are completed" — GoogleLabs implements this with `dispatchAndWait` (tool resolves only after the UI confirms, then returns the success string).

**For ~26 flight objects:** 26 x 9 fields serializes to roughly 5K+ chars — over the 1.5K budget and against the evals' "minimum essential" rule. (GoogleLabs' own `listFlights` does return everything, unbounded — that demo ignores the security budget; don't copy it.) Recommended, in order of leverage:
1. Trim fields to what choosing a flight requires: `id, airline, departureTime, arrivalTime, stops, price`. Drop `origin`/`destination` (constant — hoist to a summary header `{query: {...}, totalResults: 26, showing: 10, flights: [...]}`), drop derivable fields like `duration`.
2. Return a first page (~8-12 flights) sorted by the most likely criterion, plus a continuation mechanism — either a `nextCursor`/offset param on the tool (Vercel style) or an explicit truncation note ("Showing 10 of 26. Ask for more results or add constraints to narrow."), plus a `sortBy`/`maxPrice` input so the agent can narrow instead of page.
3. Keep flight ids stable across pages so `hold_reservation(flight_id)` can reference them.

## 4. Annotations

WebMCP's `ToolAnnotations` has exactly two booleans (spec §4.2.1) — there is no `destructiveHint`/`openToWorldHint`/title-url set as in server MCP.

Spec definitions:
- `readOnlyHint` (default `false`): "If true, indicates that the tool does not modify any state and only reads data. This hint can help agents make decisions about when it is safe to call the tool."
- `untrustedContentHint` (default `false`): "If true, indicates that the tool's output contains data that is untrusted, from the perspective of the author registering the tool."

Security page (https://developer.chrome.com/docs/ai/webmcp/secure-tools):
> "Use the readOnlyHint on tools that don't change state. This allows the agent to make better decisions about when to ask for user confirmations."

> "Use untrustedContentHint where appropriate. If a tool returns user-generated content (UGC) or externally sourced data, consider adding the untrustedContentHint to the tool."

Reference assignments in the wild:
- Vercel: read tools `{ readOnlyHint: true, untrustedContentHint: true }` (catalog data is externally sourced from Shopify); mutating `shop.add_to_cart` `{ readOnlyHint: false, untrustedContentHint: false }`.
- GoogleLabs flight demo: `listFlights` → `readOnlyHint: true`; `setFilters`/`resetFilters`/`searchFlights` → `readOnlyHint: false` — note `searchFlights` counts as mutating because it changes page/session state, not because it books anything. "State" includes UI state.

For your four: `search_flights` → `readOnlyHint: true` only if it truly changes nothing (if it drives the results UI / session search state, follow the demo and set `false`); `hold_reservation`, `update_constraints`, `confirm_booking` → `readOnlyHint: false`. `untrustedContentHint: true` on any tool returning airline/external catalog data.

**State-mutating tools:** ChatGPT's browser runs "a safety review" per invocation: "Normal website-access and confirmation policies still apply, including for consequential actions such as sending messages, making purchases, deleting data, or changing permissions." WebMCP hub: "Some actions may be sensitive, such as making a purchase. You can include a command to request user interaction with a confirmation dialog." (A `requestUserInteraction()` mechanism is still an open question in the spec, Issue #165 — not shipping.) The spec's §6.3.2.3 "Ambiguous Finalization" scenario is the cautionary tale for `confirm_booking`:

> `name: "finalizeCart", description: "Finalizes the current shopping cart"` — "Intentionally ambiguous" — actual behavior `triggerPurchase()`. Agent reasons "This tool seems to finalize the cart state for viewing," calls it, and purchases.

So: `confirm_booking`'s description must say it commits/purchases the held reservation, and Vercel additionally "reports ambiguous mutation outcomes as unsafe to retry" (never tell the agent to retry an ambiguous booking).

## 5. Multi-tool pages (5 tools incl. ping)

- **Count**: "While there isn't a maximum number of tools allowed, each tool takes up part of the context window and adds to the time for completion. The more tools you provide and the more the tools have overlap, the harder it is for the agent to pick correctly." (best-practices). Five is fine — Vercel ships 4, GoogleLabs travel 4, zaMaker ~6.
- **Single purpose, no overlap**: "Each tool should consist of a single function… Be careful not to create overlapping tools, as the agent may be confused as to what to use. Ask yourself: can I cover multiple tasks with the same function?" Watch the `update_constraints` vs `search_flights` boundary — evals flags exactly this: "Is the schema of this tool potentially too similar to another tool, leading to call ambiguity?" and "Do tool descriptions overlap, confusing the LLM about the required sequence?" If `update_constraints` re-runs the search, say so explicitly in both descriptions.
- **Chaining context**: evals — "Does the output of a preceding tool provide necessary context for the next tool call?" Your `search_flights` result should carry the `flight_id`s that `hold_reservation` consumes (Vercel does this by construction: handles come from `search_products`).
- **Dynamic registration (a scored differentiator)**: "Register tools when they're useful in a certain page state, then unregister when the tool is no longer usable" (best-practices; imperative API does this with `registerTool` + `AbortSignal`). Evals checks "Is the tool correctly exposed to the LLM in the current state/context?" and "Is the state correctly updated and any new tools exposed to the LLM as expected?" Concretely: register `hold_reservation` only when results exist; register `confirm_booking` only while a hold is active; unregister after. Fire `toolchange` naturally via this registration churn.
- **Name rules (spec, enforced)**: 1-128 chars, only `[A-Za-z0-9_.-]`; duplicate name or empty `description` rejects the `registerTool` promise with `InvalidStateError`. `getTools()` sorts alphabetically. Style is unspecified — Chrome mixes camelCase and snake_case; Vercel namespaces with a dot (`shop.search_products`). Your snake_case matches the GoogleLabs flight demo (`search_flights`, `filter_flights`, `book_flight`) and Chrome's own build-tools flight walkthrough; keep it consistent. Keep the `ping` description narrow and non-overlapping (e.g. "Check whether the page's tools are reachable") so it never competes with real tools.

## 6. Error returns — the exact recommended pattern

Chrome best-practices (the "descriptive errors as successful results" guidance):
> "Validate strictly in code, loosely in schema. … Add descriptive errors to your function code to allow the model to self-correct and retry with new, valid parameters."

Chrome build-tools (https://developer.chrome.com/docs/ai/webmcp/build-tools), the fullest statement:
> "When an agent attempts to execute a tool in an invalid state, with malformed parameters, or when a tool receives unexpected data from an underlying system, the response should act as a guide rather than a dead end. Always provide context-aware feedback to help the agent recover; avoid returning generic error messages, raw API errors, or failing silently."

Its four verbatim examples (flight-specific — two are for your exact tools):
- Wrong state / missing prerequisites: if `filter_flights` is called before `search_flights` → `"No flight search results found. Search for flights first."`
- Invalid parameters: `"Invalid date format. Provide the date in YYYY-MM-DD format."`
- Unexpected return values: `"No flights found matching your criteria. Try adjusting your search parameters."`
- Business logic violations: `"Order 123 has already shipped. Redirect the user to the returns policy."`

**Return errors as values; do not throw.** Spec behavior on a rejected `execute`: the browser only "Optionally report[s] a warning to the console describing r" and hands the caller `null` + `false` → the agent gets an opaque `UnknownError` and no self-correction path. (A non-JSON-serializable return value fails the same way.)

GoogleLabs flight demo implements it exactly as a successful string return — `"ERROR: \`destination\` must be a 3 letter city or airport IATA code."` — and their eval suite tests the recovery loop: model sends `destination: "New York"`, receives that error string, then re-calls with `"NYC"` (eval case "Book Flight: Handle Destination IATA Error").

Vercel's structured form (returned as a normal result, never thrown):
```ts
type WebMCPErrorCode = "INVALID_INPUT" | "NOT_ALLOWED" | "NOT_AVAILABLE" | "NOT_FOUND" | "UPSTREAM_UNAVAILABLE";
function toolError(code: WebMCPErrorCode, message: string) { return { error: { code, message } }; }
// e.g. toolError("INVALID_INPUT", "Select one value for every product option.")
//      toolError("NOT_FOUND", "No product exists for that handle.")
//      toolError("UPSTREAM_UNAVAILABLE", "Product search is unavailable right now.")
```
This matches the evals requirement: "Is the error structure clear enough that the model can differentiate between a temporary issue (retry) and a critical failure?" Also from best-practices: "Set a graceful failure for rate limits… return a meaningful error or advise the user to manually take on the task."

Recommended for your tools: `{ error: { code, message } }` with actionable messages — e.g. hold before search ("No search results to hold from. Call search_flights first."), expired hold, constraint conflict, and "unsafe to retry" semantics for any ambiguous `confirm_booking` outcome.

## 7. What the evals doc implies for authoring

(https://developer.chrome.com/docs/ai/webmcp/evals; runnable harness = GoogleChromeLabs/webmcp-tools `webmcp-evals`; travel examples at `webmcp-evals/examples/travel/`.)

- Test the four things in order: model understands purpose from description+schema; chooses right tool with correct params; acts on received information (chaining); completes end-to-end journeys.
- The failure-mode checklists are your authoring checklist — each row names the artifact to fix: `description` clarity/completeness, intuitive `functionName`, state-appropriate exposure, schema dissimilarity from siblings, `enum` values, per-property `description`s, explicit `required`, argument-mapping guidance, output verbosity, output formatted for LLM ingestion, retryable-vs-fatal error structure.
- `expectedCall` format: `[{ functionName, arguments }]`, supports `unordered`/`ordered` nesting for interchangeable vs sequential steps. Eval with **the full tool list registered** ("you should include all of the tools to create a simulated, complete state") because sibling tools are what cause mis-selection.
- Include both query types: "direct queries that test baseline tool execution and open-ended queries that test model reasoning and tool selection logic."
- The travel eval set shows what your schemas will be tested against — author for these: relative dates ("next monday", "this coming Friday", "in 3 days", "staying for 10 days"), airport-name→code mapping ("Heathrow"→LHR, "Gatwick"→LGW, "O'Hare"→ORD, "Narita"→NRT, "LaGuardia"→LGA), multi-airport cities (LON/NYC as city codes), "family of 4" → passengers: 4, compound filters (`stops:[0], maxPrice:500`), multi-turn state retention (filter after search; "Change the origin to Bristol" → re-`searchFlights` with BRS), and error-recovery re-calls.
- Mid-chain failures: drive the app to a state and force the preceding calls to test a tool in isolation (e.g. your `confirm_booking` with a stale/expired hold).
- Tooling: Chrome `chrome://flags/#enable-webmcp-testing` + "WebMCP – Model Context Tool Inspector" extension (inspects registered tools, validates schemas, natural-language prompts default to `gemini-3-flash-preview`); or `chrome-devtools-mcp --category-experimental-webmcp=true` to drive from a coding agent (Vercel README documents both).

## 8. ChatGPT (site tools) specifics — https://learn.chatgpt.com/docs/webmcp

- Only the **Imperative API in the top-level page** is discovered: "Declarative API: Tools defined through HTML form attributes aren't available as site tools." and "Tools in iframes: The browser doesn't discover tools registered inside iframes… Use JavaScript to register tools in the top-level page." Their sample guards with `if (typeof document.modelContext?.registerTool === "function")`.
- Models: "Use GPT-5.6 Sol or GPT-5.6 Terra for site tools. GPT-5.6 Luna currently has WebMCP disabled." Not available in Enterprise/Edu.
- Their whole example:
  ```js
  await document.modelContext.registerTool({
    name: "get_page_title",
    description: "Read the title of the current page.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    execute: async () => ({ title: document.title }),
  });
  ```
- Authoring rule, verbatim: "Keep inputs narrow, describe side effects, and return enough information to verify the result. Use your application's existing authentication, authorization, and input validation. Preserve the normal interface for people and browsers that don't support WebMCP."
- Security posture to expect: "Website-provided tool definitions and results are untrusted content… each tool invocation receives a safety review before it runs" — expect a user-facing confirmation on `confirm_booking`; descriptions that honestly state side effects survive that review better.
- `title` (human-readable label, localized) is a spec field ChatGPT's UI and Chrome's `getTools()` surface; Vercel sets it via i18n. Cheap to add, helps the confirmation dialog read well.

## 9. Conflicts between sources (flagged)

1. **MCP content blocks vs plain values.** Explainer's `add-todo` returns `{content:[{type:"text",…}]}`; every Chrome/Vercel/GoogleLabs example returns plain strings/objects, and the spec just JSON-serializes the resolved value. Use plain values. (Related: the GoogleLabs demo attaches an `outputSchema` to tools — that field is *not* in the spec's `ModelContextTool` dictionary; it's open Issue #9 and ignored by Chrome's `registerTool`. Don't rely on it.)
2. **`additionalProperties: false`.** Vercel + ChatGPT sample set it everywhere; Chrome and GoogleLabs examples never do; no doc mandates it. Harmless either way — but per best-practices, strictness belongs in code ("validate strictly in code, loosely in schema").
3. **Output size.** Security page (1.5K budget) and evals ("minimum essential") vs GoogleLabs `listFlights` returning the entire unbounded array. Follow the budget for your 26-flight result; the demo contradicts the doc.
4. **Natural-language values vs codes.** best-practices says prefer `shipping="Express"` over `shipping_id=1`; the flight demos use IATA codes with `pattern` + mapping guidance in the description, and their evals reward name→code mapping. Codes are fine for flights if the description explains them (and city codes like NYC/LON beat airport codes for user speech).
5. **Time encodings.** Shipped flight demo: minutes-from-midnight arrays `[540, 1020]`; its eval schema: `{min:"09:00", max:"17:00"}` strings. The string form aligns with "Accept raw user input."
6. **`readOnlyHint` for search.** Spec says true = "does not modify any state"; GoogleLabs marks `searchFlights` `false` because it changes UI state. Either is defensible; be consistent with what your `execute` actually mutates.
7. **Naming style.** camelCase (Chrome snippets) vs snake_case (Chrome's `get_order_status`/flight walkthrough, GoogleLabs evals, your existing tools) vs dotted namespace (Vercel). No rule; consistency and verb precision are what the docs actually ask for.

## Source list

- https://developer.chrome.com/docs/ai/webmcp/best-practices — tool strategy, naming, descriptions, schema philosophy, reliability, evals
- https://developer.chrome.com/docs/ai/webmcp/build-tools — design framework, flight-booking walkthrough, fail-gracefully error examples
- https://developer.chrome.com/docs/ai/webmcp/evals — failure modes, expectedCall, deterministic+probabilistic testing
- https://developer.chrome.com/docs/ai/webmcp/imperative-api — registerTool examples, annotations, unregistration, cancellation, getTools/executeTool
- https://developer.chrome.com/docs/ai/webmcp/secure-tools — character budgets, annotation hints, exposedTo
- https://developer.chrome.com/docs/ai/webmcp — hub; discovery/JSON-schemas/state; demos; inspector extension
- https://webmachinelearning.github.io/webmcp/ — spec: name rules, dictionary, annotations, error/serialization semantics, security considerations
- https://github.com/webmachinelearning/webmcp — explainer with tool examples; open questions (outputSchema #9, user prompting #165, skills #161)
- https://learn.chatgpt.com/docs/webmcp — ChatGPT site tools: imperative-only discovery, model support, authoring rule
- https://github.com/vercel/shop/pull/498 — production-grade schemas, pagination, output budget, toolError pattern, annotations, lifecycle
- https://github.com/GoogleChromeLabs/webmcp-tools — react-flightsearch demo (`demos/react-flightsearch/src/webmcp.ts`), travel evals (`webmcp-evals/examples/travel/{schema,evals}.json`), inspector/evals/polyfill tooling
