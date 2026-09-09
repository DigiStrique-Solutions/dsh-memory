# Working on the Strique memory fork

This is the DigiStrique fork of haitang1/dsh-memory. Preserve the MIT license and upstream attribution. The approved design is in docs/IMPLEMENTATION_PLAN.md; implementation decisions and compatibility are in docs/OPERATIONS.md.

Before changing storage, policy, learning, migration, or publication, read the relevant operations section and its behavior tests. lib/store.js is the canonical domain implementation. lib/index.js owns the DSH service, lib/tools.js its model adapters, lib/learning.js its jobs and skill provider, and lib/web.js the authenticated local reviewer API. lib/client.js is a lazy CJS Client artifact, not ordinary ESM.

Keep facts, receipts, tombstones, evidence and publication pointers in atomic scope records. Markdown and model-generated text are never authoritative metadata. All adapters must use the same policy and validation. Do not add a second writer to a live Host store. Model inputs cannot mint the local operator identity or approval.

Use npm ci --ignore-scripts, npm test, npm run check, and npm run eval. Import failures must fail tests. Host changes require real Cordis coverage; artifacts and Client changes require isolated Loader and browser coverage. A synthetic evaluation is not proof of learning gain. The live evaluation and explicit operator gate are required before enabling unattended admission.

Update types, English/Chinese documentation, configuration, and Client labels together. Keep the pinned prerelease peer range narrow until another runtime is actually tested. Follow docs/OPERATIONS.md for artifact verification and migration. Do not run old upstream Windows deployment scripts, edit the user's active profiles, tag, publish, merge main, or restart existing servers as a routine development step.

Keep artifacts/, local profiles, logs, credentials, browser auth, and generated reports out of Git and npm artifacts. The historical audit reproducer intentionally asserts upstream defects and must run only against its recorded upstream baseline, not as a release gate for this fork.
