# Verification of 0.3.0-internal.1

Date: 2026-09-09. This is an internal review artifact, not an npm release or everyday-profile deployment.

## Completed local checks

- `npm run check`: imports all Host exports, parses the real lazy Client artifact, compiles a TypeScript consumer, checks the npm file allowlist and size, and executes the behavior suite with an authoritative exit status. No import failures are skipped.
- 28 behavior tests cover scope isolation, atomic revisions and replay, archive/update/delete, pins, secret screening, bounded inputs, search filters, owner locks, restart, preview-bound migration/import, policy denial, authenticated HTTP, exact package approval, resources, stale decisions, revocation, rollback, trust classes, durable capture/jobs, cancellation, outcome attribution, evaluation gates, and separate MCP ownership/startup cleanup.
- Real published Cordis/DSH services verify tool execution, prompt assembly, storage, skill provider load and removal, session-bound exposure, dependency withdrawal/reload, session flush capture and a scripted extraction stream. Different homes sharing one backend retain separate domains.
- `npm run eval` runs deterministic safety fixtures. Its report has `liveModel: false`, zero held-out model trials, and an unfulfilled performance gate. Synthetic gate tests are labeled as synthetic.
- `npm audit` reports no known advisories in the fork's locked dependency tree at verification time. This is not a claim about unknown vulnerabilities or the entire separately installed Harness distribution.

## Packed artifact and real Client

The disposable runtime is the published `@deepseek-ai/dsh@0.1.5-alpha.1`, installed independently of the changing sibling checkout. Local execution uses Node 26.4.0 on macOS, Cordis 4.0.2 and Schemastery 3.18.2. The plugin has no lifecycle install scripts. The packed allowlist excludes tests, scripts, credentials, profiles, logs and verification fixtures.

Standard CLI add, config composition, real boot, remove and reinstall have been exercised in `artifacts/isolated-home`. Removal withdraws the fork rows. Reinstallation retains the independent data store and registers one copy of each row. Artifact changes require stopping only this disposable test process before replacing its package. The user's everyday profile is not part of the fixture.

The global `qa-browser` harness runs an authenticated smoke before mutations. The source fixture is `test/fixtures/runtime-seed.mjs`; it appends real user and tool events to a Host session and provides an authenticated test-only inspection route. It is never packed. Browser checks in `test/browser/flow.mjs` exercise:

1. The real Client module loader and Settings > Plugins > Memory and learning.
2. Fact creation, archive and restore with no browser page errors.
3. The full proposed package and resources, validation, decision reason and exact approval.
4. Loading the approved immutable resource-bearing package in a fresh Host session, then observing archive remove it and restore make it available again.
5. Pause/resume extraction and desktop layout at 1440px and 1000px, including action hit testing.

Run the configured harness with `qa-browser run dsh-memory-isolated local smoke -- --grep 'isolated memory artifact'`, then `qa-browser run dsh-memory-isolated local dsh-memory-isolated`. Browser reports and screenshots are kept outside Git in the global harness output directory. Launch-token logs remain private and are not embedded in reports.

## Limits and release gates

- No live-provider learning-gain experiment was run. The implementation cannot yet claim better held-out task performance. Unattended publication remains disabled. The operator must supply and review the required live report before enabling it.
- The pinned Harness Settings shell clips content at 720px. Desktop widths 1000px and 1440px are verified; mobile usability is not a passed release gate. Chinese labels are implemented, but a separate Chinese browser pass has not been performed.
- Linux CI passed on Node 22, 24 and 26 for implementation commit `f335d6c`: [run 34350272350](https://github.com/DigiStrique-Solutions/dsh-memory/actions/runs/34350272350). Each job ran clean installation, release checks and deterministic evaluation. Local assembled browser tests ran on Node 26/macOS.
- Procedure resources are immutable JSON content delivered inside the reviewed skill body, not a materialized executable directory. The ordinary tool policy still governs execution.
- This is a single trusted OS-account/Host-owner design. It is not organization-wide multi-tenant memory. Secret detection is heuristic, and privileged sibling plugins remain within the Host trust boundary.
- Daily model reservations are per scope. Canceling an uncooperative remote provider prevents late commits but cannot guarantee that the provider stops charging. Separate MCP mode has lifecycle cancellation, not per-request cancellation notifications.
- Capture resumes live/restored sessions; it does not eagerly scan detached historical sessions. Scope records are bounded, but the number of independent scopes is not globally capped. Retention maintenance is explicit rather than destructive automatic eviction.

No npm publish, release tag, merge to main, everyday profile activation or live autonomous-learning enablement is included in this implementation.
