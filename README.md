# Strique memory and procedural learning for DSH

Internal prerelease: **0.4.0-internal.1**. MIT fork of [haitang1/dsh-memory](https://github.com/haitang1/dsh-memory), maintained in [DigiStrique-Solutions](https://github.com/DigiStrique-Solutions/dsh-memory).

This bundle stores scoped project facts and turns Host evidence into reviewable, versioned procedures. A reviewer sees the complete previous and proposed package, source evidence, validation results, and exact hash. Approved procedures become discoverable through DSH's existing skill registry. Corrections and revocations withdraw dependent procedures immediately. This is procedural learning, not model-weight training.

The default is one local authenticated owner, project-scoped tools, local lexical recall, reviewed publication, and no remote evidence egress. Global facts are explicit operator preferences. Legacy stores remain unchanged until an explicit previewed import. There is no automatic installation into your everyday profile.

## Compatibility and installation

The target is **DSH 0.1.6-alpha.1 / Cordis 4.0.2**, with exact prerelease peers. See [operations and verification](docs/OPERATIONS.md) for the tested matrix and remaining release gates. Node 22 or later is required; the local verification uses Node 26.4.0. CI declares Node 22, 24 and 26; a declared matrix is not evidence that its remote jobs have run.

Build a local artifact with `npm ci --ignore-scripts`, `npm run check`, then `npm pack --ignore-scripts`. In an **isolated** DSH home, use the standard `dsh plugin --profile web add /absolute/path/strique-dsh-memory-0.4.0-internal.1.tgz`. This mounts four separately switchable rows: `strique-memory`, `strique-memory-tools`, `strique-memory-learning`, and `strique-memory-web`. The optional Client adds **Memory** to the sidebar and opens a dedicated main panel. Remove the old `dsh-memory` row before eventual activation; do not mount both writers over legacy data.

Peer services must come from the Harness runtime. Do not install another Cordis runtime into the profile to silence a peer warning. No npm publication or main-branch release is performed by the development scripts.

## Workflows

- Agents use `memory_read`, `memory_search`, `memory_mutate`, `memory_stats`, `learning_evidence`, `learning_resource`, and `learning_propose`. Scope and session identity come from the Host. Mutation requires an expected fact revision and a unique idempotency key. Use revision `0` to add a fact.
- The learning row observes complete Host session ranges, retains bounded evidence and persisted jobs, and optionally asks the configured DSH model for procedure candidates. A user statement, tool observation, assistant claim, and cancellation remain distinct. Missing routes, disabled egress, budgets and failures stay visible in job status.
- In Memory, inspect candidates and evidence, validate, then approve or reject with a reason. A stale candidate or target hash cannot be approved. Pending and rejected candidates are never advertised to models. The main skill loads instructions and a resource index; `learning_resource` reads one immutable resource after rechecking scope, visibility and revision; creating a script grants no execution permission.
- Archive, restore, pin, roll back, revoke evidence, record a reviewed outcome, and pause extraction in the same UI. A registry load is an exposure, not a success. Only the local reviewer can attest a success/failure against tool evidence.
- Fact export/import transfers bounded JSON in the browser. Import requires a preview hash and current scope revision. Host tools accept no arbitrary filesystem import, export, or HTML output paths.

Background extraction starts at a durable `turn/end`, not at every flush. Explicit facts require an exact user statement and pass conservative quotation/conflict checks. This is heuristic classification, not a guarantee of semantic truth. Inferred facts, conflicts and ambiguous text stay in **Fact review**. Source revocation archives dependent facts and withdraws procedures.

Reviewed failures schedule one refinement against the used skill revision. The extractor receives bounded existing packages, facts, outcomes and rejection history. The status page separates capture, extraction, automatic facts, reviewed admission, queue capacity and provider usage. Terminal work compacts without discarding pending evidence; unreclaimable reference limits produce explicit capacity errors.

## Configuration

Memory row settings are live through DSH's `strique-memory` settings namespace and the authenticated local Client. Configuration contains no API keys. The selected DSH model provider owns credential resolution and rotation.

| Memory setting | Default | Meaning |
|---|---|---|
| `read` | `true` | Allow project recall and skill discovery. |
| `capture` | `true` | Allow evidence, proposals, jobs and outcome tracking. |
| `autoFacts` | `true` | Automatically save explicit non-conflicting user facts after extraction; inferred/conflicting facts require review. |
| `mutate` | `true` | Allow fact changes and previewed import. |
| `publish` | `true` | Allow reviewed procedure publication and maintenance. |
| `export` | `true` | Allow the local operator to export facts. |
| `remoteEgress` | `false` | Allow bounded evidence to the configured model. |
| `recallBytes` | `8192` | Complete-fact recall budget, from 512 to 32768 bytes. |

Learning row composition options: `enabled: true`, `provider: ''`, `model: ''`, `dailyTokens: 20000`, `maxTokens: 2048`, `inputBytes: 12288`, `timeoutMs: 60000`. Empty provider/model uses the current DSH model selection; an unavailable route leaves jobs pending. Changing row options uses normal Cordis reconfiguration. Disabling extraction leaves the admitted provider available. The runtime conservatively reserves input UTF-8 bytes plus output allowance and prompt overhead against each scope's daily budget; reservations survive crashes and are not refunded based on untrusted provider reports.

## Evaluations and unattended admission

`npm run eval` executes deterministic safety checks and reports **no measured learning gain**. For a live evaluation, run `node scripts/evaluate.mjs --driver /path/live-driver.mjs --corpus /path/held-out-corpus.json`. The contract and isolation rules are in [operations](docs/OPERATIONS.md). Expected answers never enter the driver input.

Unattended admission is off by default. Its implementation requires an explicit local reviewer action with a live evaluation report containing at least 30 paired held-out tasks per mode in each of two or more repetitions, all required safety checks, at least six improvements over memory-only, and no unexplained regression. The report must use the end-to-end `session-learning-v2` protocol and match the current plugin code, runtime and effective policy/route. Configuration changes invalidate eligibility. The reviewer attests the report's origin and oracles. Eligible trust classes exclude unsupported assistant claims. Evaluation documents are not self-authenticating, and the gate is not a claim that arbitrary learned text is safe. No unattended policy is enabled by tests or installation.

## Data and migration

The Host opens schema-validated `storageDomain` records. Each bounded scope is a single atomic consistency unit containing facts, tombstones, replay receipts, evidence, jobs, candidates and publication pointers. Objects live under `$DSH_HOME/strique-memory-v2/objects`. The JSON domain is routed through the existing DSH storage configuration. A loopback OS ownership lease prevents concurrent live writers in the same home without creating a persistent lock file; the kernel releases the lease automatically when a process exits.

For a frozen schema-v1 domain, run `dsh-memory-upgrade FROZEN_SNAPSHOT OLD_OBJECT_DIRECTORY NEW_HOME/strique-memory-v2`. The target must not exist. The source stays unchanged; the Host imports the hash-checked v2 snapshot once under its ownership lease. Legacy incomplete jobs stay paused, old automatic-admission eligibility is cleared, and legacy model-authored usage becomes unknown. See the full [upgrade procedure](docs/OPERATIONS.md).

Use `dsh-memory-migrate LEGACY_DIRECTORY > migration-preview.json` to inspect legacy active/archive files without changing them. Keep a complete backup and review the report and accepted entries against the originals. Paste the report's `data` object into Import, preview it, then apply. Lossy Markdown cannot prove original intent; suspicious boundaries, duplicate IDs and detected credentials are quarantined. Summary/AGENTS seeding and automatic legacy conversion have been removed.

The optional stdio MCP adapter requires all three variables: `DSH_MEMORY_MODE=separate`, `DSH_MEMORY_DIR=/absolute/separate/store`, and `DSH_MEMORY_PROJECT=/absolute/project`. It uses the same fact policy/validation and an exclusive writer lock. It cannot share the Host store, approve procedures, export files, or expand its configured scope.

See [operations](docs/OPERATIONS.md), the [implementation plan](docs/IMPLEMENTATION_PLAN.md), and [upstream audit](docs/audit/2026-09-09.md). The old Markdown format and 14-tool interface are intentionally not the new canonical API. Remote embeddings, automatic AGENTS seeding, and legacy Windows deployment scripts are not supported by this fork.

## Memory workspace

Open **Memory** in the main sidebar. It opens a dedicated main panel without changing your current chat; **Back to chat** returns to the conversation. The entry stays available as an icon when the sidebar is collapsed. Policy controls live in the workspace's Settings tab.

Saved facts use inline add/edit/cancel controls. Edit, archive/restore, pin/unpin, delete and refresh are icon buttons with accessible names and hover/focus labels; pin exposes its selected state. Approval and rejection retain explicit text labels. Fact review and Procedures keep source evidence and version-bound decisions together; Activity summarizes extraction and usage. Import/export, diagnostics, and admission controls are expandable. The Client uses Harness theme tokens in light and dark mode. Policy and durable writes remain on the authenticated Host.
