# Operations and compatibility

Internal artifact: 0.3.0-internal.1. Do not publish or activate in an everyday profile as part of local verification.

## Boundaries and persistence

`strique-memory` owns the canonical service. The tools row derives project identity from the realpath of the session working directory and nearest `.git` ancestor. Worktrees with distinct Git markers remain distinct projects. No implicit global fallback exists. The reviewer can select existing Host scopes or explicitly manage global preferences. The system is single-owner; organization ownership of the repository does not share its data.

The Host uses `ctx.storageDomain`, schema version 1. A scope aggregate is the atomic unit, bounded to 8 MiB, 2000 facts with 20 historical versions each, 4000 evidence records, 1000 candidates/jobs, 500 publications, 4000 outcome receipts and 8000 mutation receipts. Quota failures do not evict unconsumed records. This implements the plan's transaction boundary using a scope aggregate instead of many records, allowing revocations and dependent publication changes in one durable write. There is no cross-process or cross-domain transaction assumption.

The existing Host storage backend owns canonical domain files. The domain name includes a hash of the memory home, isolating distinct homes even when they share a backend. The fork's owner lock lives in `$DSH_HOME/strique-memory-v1/.owner.lock`; two live profiles in one home cannot both write. Use separate homes and backend roots for separate owners. The optional MCP mode owns a separate bounded JSON backend and refuses the Host directory. Other privileged plugins and the OS account are inside the trusted Host boundary.

Immutable procedure JSON objects are addressed by SHA-256 under `objects/`. Candidate admission includes exact package, evidence, fact revisions and previous publication hash. The complete object is persisted before its publication pointer changes. An orphan object after a crash is inert. Missing or hash-mismatched objects fail closed. Metadata loading is active-only, scoped, and uses the stock skill registry at the lowest precedence; pending candidates never appear there. Resources are delivered as reviewed in-body resources and structured metadata, not executable materialized files. Execution remains subject to ordinary DSH tool policy.

Fact recall is computed from current active records and exact revision references at each prompt assembly. No asynchronous summary can overwrite a correction or rollback. Whole facts fit the budget or are omitted. The former raw/journal/summary and AGENTS fingerprint paths are retired. There is no remote embedding call or unfiltered secondary ranking path.

## Policy, review, and credentials

The HTTP prefix uses DSH connection authentication plus a direct loopback peer and local Host header. Forwarding headers are denied. Requests are JSON POST envelopes with a 9 MiB request and response cap (imports are limited to 8 MiB) and a 10-second request lifetime. Endpoints are an explicit business-operation allowlist. No API key, settings base layer, bearer token, shell command or unrestricted path is returned.

Memory settings are a required service dependency, live and schema validated; invalid saved settings fail initialization. Read, capture, mutate, publish, export and remote egress are separate policy decisions. Provider/model and extraction budget are composition settings on the learning row. The configured DSH LLM provider owns secrets; this plugin never stores embedding API keys. Synthetic secret detection applies recursively to raw strings, metadata, evidence, proposals, persistence, egress and exported/rendered outputs. This heuristic is defense in depth, not a universal secret classifier. Avoid retaining confidential source material at all when its use is not authorized.

Local operators validate and approve the complete package hash. Validation checks shape, size, safe resource paths and evidence references. It does not prove the instructions are correct. User statements, successful tool operations and unsupported assistant claims remain different trust classes. Tool success is not automatically a task success. Reviewers can attest outcomes only with existing tool evidence; actual model skill-tool loads record session-bound exposure separately; reviewer previews do not count as use.

## Jobs, cancellation and recovery

Capture uses Host event envelopes and exact event watermarks, including seq 0. Fork-inherited prefixes are excluded, but fresh events in a fork are eligible. Plugin-injected messages and known memory/learning tool outputs are excluded. Oversized or credential-bearing records are retained only as explicit omitted-evidence markers. Batches acknowledge complete included records. Target watermarks expose outstanding capture work. Live/restored sessions are rescanned and session flush checkpoints capture remaining ranges; detached session history remains in DSH and is resumed when restored.

Jobs are bounded, persistent and idempotent by session/event range. A worker processes one job at a time, retries up to three attempts with backoff, and expires work after seven days. Missing model route, disabled egress and insufficient daily budget remain pending with reasons. A job's previous reservation is retained after interrupted execution. Pause, dependency removal and plugin disposal cancel work; late provider results cannot publish after their owner stops. Removal drains operations before releasing the store lock. A provider that ignores cancellation may still incur remote cost after its request is abandoned; its late result has no commit authority.

To recover a crashed owner: stop the old process deliberately, verify that the lock PID is gone and no other profile uses the same backend root, back up the fork directory and canonical domain file, then remove only the stale `.owner.lock`. Never use age-based lock stealing. Restart with the same artifact and schema. Pending/running jobs resume with preserved reservations. Do not remove a lock from a running Host.

Failed or quota-blocked work stays visible. Export and explicitly archive a completed store before starting a new bounded store if retention quotas are exhausted. Automatic destructive retention or purging is not provided.

## Migration and rollback

1. At an explicitly scheduled activation, freeze the old writer and back up the entire legacy directory. Also preserve the previous profile package manifest and patch.
2. Run `dsh-memory-migrate LEGACY_DIRECTORY > migration-preview.json`. Review checksums, accepted facts, duplicates and quarantine entries against the original source. The preview reads bounded regular files without following final symlinks. It never writes the legacy directory.
3. Use the new independent store. The report's `data` object can be pasted into the Client import form. Review the second preview, then apply its hash and expected scope revision. Import is additive, deduplicates content, preserves active/archive state and records legacy IDs as provenance. It does not claim to reconstruct lossy or forged Markdown perfectly.
4. Verify a fresh project session sees the fact, an update changes it, and a deletion removes it. Approve a candidate and verify the exact resource-bearing package loads from a fresh session. Archive/restore and roll back a reviewed historical hash.
5. Roll back code by restoring the previous pinned package and its matching data backup. Legacy code must never open the new canonical domain. Removing the plugin preserves data. Rolling back a learned procedure changes an immutable pointer and cannot restore revoked evidence.

The historical audit script in `docs/audit/reproduce-2026-09-09.mjs` asserts defects in upstream `a7d6794`. It is not an acceptance test for this new implementation. The new behavior tests replace its assertions with safety expectations.

## Evaluation protocol

`node scripts/evaluate.mjs` runs the deterministic suite and outputs a report with `liveModel: false` and an unfulfilled performance gate. This is the report produced during implementation; no percentage improvement is claimed.

A live driver is an operator-controlled ESM module exporting `liveModel = true`, a pinned `model` identity, and `async run(input, {signal, maxTokens})`. It returns `{answer, tokens}`. The input includes only the task, admitted facts/procedures and the same tool policy. It must use the same route and configuration across modes and honor cancellation. Running it may incur the configured provider's normal costs.

A corpus is an array of 30 to 100 distinct entries shaped as `{id, training:{facts:string[], evidence:string, package:ProcedurePackage}, heldOut:{input:unknown, expected:unknown}}`. Training/capture material must differ from held-out tasks. Expected outputs are canonical JSON oracles outside the driver input. Each trial starts with an isolated store. The three modes are none, hardened memory, and memory plus reviewed procedures. The runner measures exact-oracle success, tokens and latency and compares paired trials. Repeat with independent runs and report uncertainty before claiming general improvement. Do not use model-as-judge alone.

The local operator can enable unattended admission only after reviewing a live report that passes required safety families, at least 30 trials per mode, six paired improvements and no unexplained paired regression. The accepted report hash is retained with the policy. Reports are operator attestations, not cryptographically verified measurements. Ineligible/unverified candidates, changed base hashes, pins, revocations, pause and disabled publication still deny activation. Tests exercise the gate with explicitly synthetic observations and never activate it in an installed profile.

## Verification evidence

Local tests use installed published DSH 0.1.5-alpha.1 packages, Cordis 4.0.2, Schemastery 3.18.2, and Node 26.4.0 on macOS. Real Cordis coverage includes canonical storage, model tools, prompt assembly, provider catalog/load, resource delivery, unload and reopen. The isolated CLI uses a separately installed published DSH runtime, not the concurrently changing workspace source checkout.

Artifact verification uses standard CLI add, composed config, real boot, authenticated HTTP, the real Client module loader, browser interactions, remove, and reinstall. Detailed completed checks and any remaining limitations are recorded in `docs/VERIFICATION.md`. Node 22/24/26 Linux CI results are linked in the verification report. Live-model performance trials remain unrun.
