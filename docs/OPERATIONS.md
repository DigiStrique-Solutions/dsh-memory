# Operations and compatibility

Internal artifact: 0.4.0-internal.1. Do not publish or activate in an everyday profile as part of local verification.

## Boundaries and persistence

`strique-memory` owns the canonical service. The tools row derives project identity from the realpath of the session working directory and nearest `.git` ancestor. Worktrees with distinct Git markers remain distinct projects. Project writes remain scoped. Explicit operator global preferences join bounded recall with a scope label. The reviewer can select existing Host scopes or explicitly manage global preferences. The system is single-owner; organization ownership of the repository does not share its data.

The Host uses `ctx.storageDomain`, schema version 2. A scope aggregate is the atomic unit, bounded to 8 MiB, 2000 facts with 20 historical versions each, 4000 evidence records, 1000 candidates/jobs, 500 publications, 4000 outcome receipts and 8000 mutation receipts. Quota failures do not evict unconsumed records. This implements the plan's transaction boundary using a scope aggregate instead of many records, allowing revocations and dependent publication changes in one durable write. There is no cross-process or cross-domain transaction assumption.

The existing Host storage backend owns canonical domain files. The domain name includes a hash of the memory home, isolating distinct homes even when they share a backend. The fork's owner lock lives in `$DSH_HOME/strique-memory-v2/.owner.lock`; two live profiles in one home cannot both write. Use separate homes and backend roots for separate owners. The optional MCP mode owns a separate bounded JSON backend and refuses the Host directory. Other privileged plugins and the OS account are inside the trusted Host boundary.

Immutable procedure JSON objects are addressed by SHA-256 under `objects/`. Candidate admission includes exact package, evidence, fact revisions and previous publication hash. The complete object is persisted before its publication pointer changes. An orphan object after a crash is inert. Missing or hash-mismatched objects fail closed. Metadata loading is active-only, scoped, and uses the stock skill registry at the lowest precedence; pending candidates never appear there. Main skill loads contain instructions and resource paths only. The learning_resource tool reads one immutable resource, rechecking scoped registry visibility, model invocation, loader availability and active hash. Resources are data, not materialized executable files. Execution remains subject to ordinary DSH tool policy.

Fact recall is computed from current active records and exact revision references at each prompt assembly. No asynchronous summary can overwrite a correction or rollback. Global preferences have a separate limit of half the total recall budget, capped at 2048 bytes. Whole facts fit the budget or are omitted; every reference carries its scope and exact revision. The former raw/journal/summary and AGENTS fingerprint paths are retired. There is no remote embedding call or unfiltered secondary ranking path.

## Policy, review, and credentials

The HTTP prefix uses DSH connection authentication plus a direct loopback peer and local Host header. Forwarding headers are denied. Requests are JSON POST envelopes with a 9 MiB request and response cap (imports are limited to 8 MiB) and a 10-second request lifetime. Endpoints are an explicit business-operation allowlist. No API key, settings base layer, bearer token, shell command or unrestricted path is returned.

Memory settings are a required service dependency, live and schema validated; invalid saved settings fail initialization. Read, capture, mutate, automatic facts, publish, export and remote egress are separate policy decisions. Provider/model and extraction budget are composition settings on the learning row. The configured DSH LLM provider owns secrets; this plugin never stores embedding API keys. Synthetic secret detection applies recursively to raw strings, metadata, evidence, proposals, persistence, egress and exported/rendered outputs. This heuristic is defense in depth, not a universal secret classifier. Avoid retaining confidential source material at all when its use is not authorized.

Local operators validate and approve the complete package hash. Validation checks shape, size, safe resource paths and evidence references. It does not prove the instructions are correct. User statements, successful tool operations and unsupported assistant claims remain different trust classes. Tool success is not automatically a task success. Reviewers can attest outcomes only with later tool evidence from the same exposed session and skill revision; actual model skill-tool loads record session-bound exposure separately; reviewer previews do not count as use.

## Jobs, cancellation and recovery

Capture uses Host event envelopes and exact event watermarks, including seq 0. Fork-inherited prefixes are excluded, but fresh events in a fork are eligible. Plugin-injected messages, memory/learning tool outputs and skill bodies are excluded. Tool results carry their matching arguments or an explicit missing-context marker. Subagent sessions are not independently mined; their returned tool observations in the parent remain ordinary untrusted evidence. Oversized or credential-bearing records are retained only as explicit omitted-evidence markers. Batches acknowledge complete included records. Target watermarks expose outstanding capture work. Live/restored sessions are rescanned and session flush checkpoints capture remaining ranges; detached session history remains in DSH and is resumed when restored.

Flushes capture immediately. Durable turn/end events schedule reviews. Long turns split into contiguous parts of at most 64 evidence records with explicit part labels. Each part may be input-blocked when its full selected context exceeds inputBytes; no silent truncation is presented as complete context.

Jobs are bounded, persistent and idempotent by session/event range. A worker processes one job at a time, retries up to three attempts with backoff, and expires work after seven days. Missing model route, disabled egress and insufficient daily budget remain pending with reasons. A job's previous reservation is retained after interrupted execution. Pause, dependency removal and plugin disposal cancel work; late provider results cannot publish after their owner stops. Removal drains operations before releasing the store lock. A provider that ignores cancellation may still incur remote cost after its request is abandoned; its late result has no commit authority.

To recover a crashed owner: stop the old process deliberately, verify that the lock PID is gone and no other profile uses the same backend root, back up the fork directory and canonical domain file, then remove only the stale `.owner.lock`. Never use age-based lock stealing. Restart with the same artifact and schema. Pending/running jobs resume with preserved reservations. Do not remove a lock from a running Host.

Expired jobs become terminal before route/egress checks. Terminal jobs compact behind settled watermarks, retaining the newest 100. Evidence referenced by pending jobs, candidate review, factual history, outcomes or rollback dependencies remains protected. Recent 256 and unscheduled evidence are retained. The status page provides a read-only preview and exact-revision compaction action. Unreclaimable limits return capacity-jobs, capacity-evidence or review-capacity errors. Unknown provider usage is counted explicitly, including interrupted attempts; reservations are never refunded from model-authored tokens.

## Factual and procedural learning

With capture, mutate and autoFacts enabled, extraction may save exact explicit user statements that have no detected conflict. Full source equality and conservative quotation/hypothetical markers limit automatic admission. Lexical overlap identifies possible conflicts against existing active facts; it is deliberately conservative and cannot detect every semantic contradiction. Other proposals require exact-hash review. Stale base revisions cannot overwrite newer facts. Every content revision carries its current source; prior provenance stays in history. Revoking source evidence archives its dependent facts and procedures.

Refinement receives bounded full packages, current facts, reviewed outcomes and earlier decisions. Host validation binds every reference and target revision. Identical packages and repeated proposals do not create new actionable reviews. Semantic preservation is still a reviewer and live-evaluation concern. Reviewed failures and explicit maintenance schedule deduplicated jobs targeting that revision; stale targets fail closed.

## Schema-v1 upgrade

Freeze a consistent copy of the canonical v1 domain plus its object directory. Never run a second writer against the live Host. Choose a new home and run:

```sh
dsh-memory-upgrade /snapshots/v1-domain.json /snapshots/objects /new-home/strique-memory-v2
```

The new destination must not exist. The CLI validates all scopes and immutable object hashes, stages the conversion and writes a completion manifest before activating the target directory. Original IDs, fact revisions, receipts, tombstones and object contents remain intact. Duplicate keys, unknown schemas and missing/corrupt objects reject the target. The old snapshot is never modified.

The v2 Host imports the completed snapshot under its owner lock before exposing services. Partial scope imports resume only when existing records still match the snapshot; an import completion marker prevents later edits from being overwritten. Pending/running v1 jobs are paused as legacy-context-review-required and old capture watermarks are not silently replayed. Recover missing causal context from the original session through a deliberate later task. Old unattended admission is cleared; legacy model-authored usage is not treated as observed provider usage.

## Legacy Markdown migration and rollback

1. At an explicitly scheduled activation, freeze the old writer and back up the entire legacy directory. Also preserve the previous profile package manifest and patch.
2. Run `dsh-memory-migrate LEGACY_DIRECTORY > migration-preview.json`. Review checksums, accepted facts, duplicates and quarantine entries against the original source. The preview reads bounded regular files without following final symlinks. It never writes the legacy directory.
3. Use the new independent store. The report's `data` object can be pasted into the Client import form. Review the second preview, then apply its hash and expected scope revision. Import is additive, deduplicates content, preserves active/archive state and records legacy IDs as provenance. It does not claim to reconstruct lossy or forged Markdown perfectly.
4. Verify a fresh project session sees the fact, an update changes it, and a deletion removes it. Approve a candidate and verify the exact resource-bearing package loads from a fresh session. Archive/restore and roll back a reviewed historical hash.
5. Roll back code by restoring the previous pinned package and its matching data backup. Legacy code must never open the new canonical domain. Removing the plugin preserves data. Rolling back a learned procedure changes an immutable pointer and cannot restore revoked evidence.

The historical audit script in `docs/audit/reproduce-2026-09-09.mjs` asserts defects in upstream `a7d6794`. It is not an acceptance test for this new implementation. The new behavior tests replace its assertions with safety expectations.

## Evaluation protocol

`node scripts/evaluate.mjs` runs the deterministic suite and outputs a report with `liveModel: false` and an unfulfilled performance gate. This is the report produced during implementation; no percentage improvement is claimed.

The end-to-end protocol is `session-learning-v2`. The runner owns real Cordis memory, sessions, skill registry, stock skill tool and prompt assembly. Training conversation events flow through capture, completed-turn scheduling, actual extraction and review. A fresh held-out session discovers catalog metadata and calls real scoped tools. Every write boundary is frozen before revealing the held-out task. Expected outputs never enter model or reviewer inputs.

An operator-controlled ESM driver exports a pinned `model`, `liveModel`, `stream(request)` yielding DSH LLM chunks, `review(candidate)` returning an explicit benchmark review decision, and `run(input, {signal, maxTokens, execute})`. The run input has task, system prompt, messages and tool schemas, never finished procedures or expected answers. It returns `{answer, usage:{totalTokens}}`; execute calls the runner's permitted real tools. The reviewer must follow the agreed training-only review policy. A scripted driver proves orchestration only.

The corpus is `{cases, repetitions, extraction}`. Use 30 to 100 distinct cases, each `{id, training:[{type,data}], heldOut:{input:string,expected:JSON}}`, and 2 to 5 repetitions. Training accepts user/message, assistant/message, tool/call and tool/result envelopes; it cannot supply finished packages. Extraction contains learning-row settings for the same pinned route across modes. Modes are none, factual memory and memory plus reviewed procedures. Isolated homes prevent cross-case learning. Reports separate extraction/future/total costs and paired success with Wilson intervals. Missing usage or oracle data cannot pass.

The live admission gate recomputes results, requires six paired improvements and no paired regressions against factual memory, and binds the report to plugin source hash, version, declared tested runtime and effective extraction/policy configuration. Configuration drift disables effective admission. Named safety families include the actual passing test identities. `npm run eval:supplied` retains the old supplied-package benchmark under its distinct protocol; it cannot authorize unattended learning. Reports remain operator attestations, not self-authenticating measurements. No live model run or autonomous-policy enablement is implied by tests.

## Verification evidence

Local tests use installed published DSH 0.1.6-alpha.1 packages, Cordis 4.0.2, Schemastery 3.18.2, and Node 26.4.0 on macOS. Real Cordis coverage includes canonical storage, model tools, prompt assembly, provider catalog/load, resource delivery, unload and reopen. The isolated CLI uses a separately installed published DSH runtime, not the concurrently changing workspace source checkout.

Artifact verification uses standard CLI add, composed config, real boot, authenticated HTTP, the real Client module loader, browser interactions, remove, and reinstall. Detailed completed checks and any remaining limitations are recorded in `docs/VERIFICATION.md`. This repair requires new Node 22/24/26 CI results; older CI runs do not certify it. Live-model performance trials remain unrun.
