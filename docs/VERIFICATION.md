# Verification of 0.4.0-internal.1

Date: 2026-09-16. Internal implementation, isolated verification and explicitly requested local activation. The activation is recorded separately below.

## Source checks

- Clean `npm ci --ignore-scripts` installs the exact lockfile without lifecycle scripts. The dependency audit reported no known advisories in this plugin tree at check time.
- `npm run check` checks Host exports, Client syntax, TypeScript consumers, artifact allowlist/size and the behavior suite. Import errors fail the run.
- Behavioral coverage includes real completed-turn capture, retained capture with extraction disabled, current factual provenance, exact conflict review, source revocation, bounded review parts, expiration under disabled egress, provider usage for invalid output, scope failure isolation, contextual refinements and reviewed outcome scheduling.
- A disk-backed integration test completes 1,005 review cycles, keeps the queue bounded, reopens the store and verifies that settled ranges do not replay. It uses a scripted external provider and takes about one minute locally.
- Real Cordis integration exercises tool execution, prompt assembly, stock skill loading, scoped tool restrictions, protected registry shadows, resource disclosure, exposure tracking, unload/reload and dependency withdrawal. A separate test upgrades a frozen v1 snapshot, imports it through the real Host and verifies that a later edit survives reload.
- The evaluator's real Harness test derives a package from training events and discovers it via the stock skill tool in a fresh session. No-memory and factual-memory modes are also tested with writes frozen. These are scripted correctness tests, not live performance measurements.

The exact command outputs are local artifacts: `repair-check.log`, `repair-capacity-test.log`, `repair-evaluation.json` and `repair-evaluation-errors.log`. These files and temporary homes are excluded from Git and npm.

## Isolated artifact and browser procedure

Target: published DSH 0.1.6-alpha.1, Cordis 4.0.2, Schemastery 3.18.2, Node 26.4.0 on macOS. The separately installed CLI is under `artifacts/repair-runtime`; artifact verification uses `artifacts/final-home`. No edits to the sibling Harness source are required.

Pack with `npm pack --ignore-scripts`, install the tarball using the standard DSH CLI, inspect composed rows and boot a separate home. Remove/reinstall in an offline disposable profile to verify composition and data retention. The source fixture `test/fixtures/runtime-seed.mjs` is test-only and never packed.

Use the global `qa-browser` harness with the `dsh-memory-repair` profile. Run smoke before browser mutations. The flow covers:

1. Authenticated Client loading through Settings > Plugins.
2. Fact creation, archive/restore, and exact review of an inferred or conflicting fact with its original statement.
3. Distinct capture/extraction/fact/admission status and visible egress blocks.
4. Full procedure and resource review, exact approval, fresh-session visibility, archive and restore.
5. Real skill exposure followed by same-session tool evidence selected in the outcome UI.
6. Scope changes clear review state; desktop screenshots at 1440px and 1000px have no page errors or document overflow.

The first browser test failed because the factual review tab did not exist. After implementation, the three source browser scenarios passed. The extended outcome scenario passed on the packed artifact. Final artifact runs are recorded separately in `final-smoke.log` and `final-browser.log`; use their exit status and the global Playwright report as the acceptance evidence. Launch tokens remain private and are redeemed before page navigation, with trace/video disabled for these authenticated fixtures.

## Frozen-copy upgrade rehearsal

A copy of the audited v1 domain contained 3 scopes, 1 fact, 1,150 evidence records and 859 jobs. The upgrade preserved facts, receipts and evidence exactly. Pending legacy work stayed paused; no live store was written and no extraction was dispatched. The private rehearsal is under `artifacts/frozen-upgrade-rehearsal`.

Offline CLI removal withdrew all four plugin rows. Reinstallation restored exactly one copy of each and retained the independent data directory. This composition check used `artifacts/lifecycle-home`.

## Limits

- No live-model learning-gain evaluation or unattended-admission enablement is included. A `liveModel: false` or supplied-procedure report cannot satisfy the new gate.
- Semantic fact classification, conflict detection and procedural quality still need a live corpus. Exact source checks and lexical/quotation heuristics are conservative safeguards, not proof of semantic correctness.
- Long turns split into bounded parts; an oversized complete part is explicitly input-blocked. Missing call context and omitted oversized/credential-bearing events stay marked. Detached sessions and independent subagent histories are not mined automatically.
- Referenced evidence, review history and replay receipts are not silently evicted. Exhausting unreclaimable aggregate limits requires deliberate archival or a new store.
- No new Node 22/24 Linux CI run or separate Chinese/mobile browser pass is claimed. Previous CI results do not certify this repair.
- The current published registry API is tested. A separately modified skills-manager/registry deployment requires its own composition check; resource reads use that registry's effective visibility rather than bypassing it.
- This remains a single trusted OS-account/Host-owner system. Secret screening is heuristic. Canceling a remote request cannot guarantee that billing stops, so reservations are retained.

The isolated checks above did not publish, tag, merge or change the everyday profile. The later authorized local activation is recorded below.

## Memory workspace redesign

The Client registers a dedicated `main` panel and matching `sidebar.panellist` entry named Memory. It no longer contributes a review screen to `settings.plugin.item`. Both registrations belong to the Client fiber; the sidebar registration waits for its slot declaration. There is no nested workspace modal or document Escape listener. Host contracts and policy checks are unchanged.

Icon actions have accessible names, title/hover/focus labels, keyboard activation and a pressed state for pin/unpin. Decision buttons retain text. Inline editing, progressive technical controls, activity summaries and theme styles are retained. Navigation clears old tab data before rendering; re-selecting the current tab keeps its contents.

Verification uses the isolated `artifacts/ui-home` profile on port 3220, with the pinned published runtime and synthetic fixture. Run `qa-browser run dsh-memory-repair local smoke` first, then scenarios `dsh-memory-repair`, `dsh-memory-design` and `dsh-memory-navigation`, with `MEMORY_QA_BASE=http://127.0.0.1:3220`, `MEMORY_QA_HOME=ui-home`, and `MEMORY_QA_LOG=ui-server.log`. Launch tokens are redeemed privately before navigation. The navigation test covers sidebar entry, main panel selection, icon-only pin action, keyboard activation, persistence after leaving and returning, and a collapsed sidebar at 390px. The other five scenarios cover editing/cancel, progressive controls, dark appearance, tab navigation, fact review, procedure publication, outcomes and pause/resume.

English and Chinese labels are supplied; Chinese browser layout is not separately certified. No everyday profile was edited or server restarted for this redesign.

## Authorized local activation

After isolated verification, the user requested installation and activation in the local web profile. The tested 0.4.0-internal.1 archive was installed through the supported plugin CLI against Harness 0.1.6-alpha.1. Its SHA-256 is `adbfd11b976a761828d08709784e550127035c61fe1c9e6f48920ba97ab13b98`; installed files matched the archive. This identifies the deployed artifact, before this activation note was added.

The profile was backed up and gracefully restarted after confirming no running chats. All four memory components were active, with no failed enabled plugins. Effective composition was unchanged. Authenticated API checks, browser smoke and the Memory sidebar/main-panel workflow passed.

Migration preserved three scopes, the existing fact, all 1,150 evidence records and all 859 legacy jobs. Legacy jobs remain paused for context review; the original v1 domain remains unchanged for rollback. Existing policy was retained, including disabled remote egress. Automatic factual extraction cannot dispatch model requests under that policy, and unattended procedure admission remains disabled. No live-model learning gain is claimed.

Private backups, profile configuration, memory records, authentication data and activation reports remain outside Git and npm artifacts. Local activation is not an npm publication or merge approval.
