#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { readFile, mkdtemp, realpath, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { FileBackend, Objects } from '../lib/files.js'
import { MemoryStore } from '../lib/store.js'
import { project, digest, safe } from '../lib/policy.js'
import { assessEvaluation, SAFETY_CASES, MODES } from '../lib/evaluation.js'
const args = process.argv.slice(2),
  option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined)
const driverPath = option('--driver'),
  corpusPath = option('--corpus')
const testOutput = execFileSync(
  process.execPath,
  [
    '--test',
    '--test-reporter=tap',
    ...['store', 'learning', 'host', 'web', 'mcp', 'migration', 'evaluation'].map(
      (name) => 'test/' + name + '.test.js'
    )
  ],
  { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }
)
const safety = SAFETY_CASES.map((name) => ({ name, passed: true }))
const report = {
  format: 'strique-memory-evaluation',
  version: 1,
  liveModel: false,
  model: 'none (deterministic safety only)',
  corpusHash: digest(testOutput),
  safety,
  trials: [],
  gate: 'not-evaluated',
  notes: [
    'Safety fixtures are not evidence of a task-success improvement. No unattended admission is enabled.'
  ]
}
if (driverPath || corpusPath) {
  if (!driverPath || !corpusPath) throw new Error('Provide both --driver and --corpus')
  const driver = await import(pathToFileURL(resolve(driverPath)).href),
    corpus = JSON.parse(await readFile(corpusPath, 'utf8'))
  if (
    driver.liveModel !== true ||
    typeof driver.model !== 'string' ||
    typeof driver.run !== 'function'
  )
    throw new Error('Driver must identify a live model and implement run(input, options)')
  if (!Array.isArray(corpus) || corpus.length < 30 || corpus.length > 100)
    throw new Error('Use 30 to 100 held-out cases')
  report.liveModel = true
  report.model = driver.model
  report.corpusHash = digest(corpus)
  for (const mode of MODES)
    for (const entry of corpus) {
      const root = await realpath(await mkdtemp(join(tmpdir(), 'memory-eval-')))
      try {
        const backend = new FileBackend(root)
        await backend.init()
        const objects = new Objects(root)
        await objects.init()
        const store = new MemoryStore(backend, objects),
          p = project(root),
          caller = {
            principal: 'owner',
            kind: 'operator',
            scope: p.key,
            root: p.root,
            session: entry.id
          }
        let recalled = [],
          procedures = []
        if (mode !== 'none')
          for (const [i, fact] of (entry.training.facts ?? []).entries())
            await store.mutate(caller, {
              op: 'add',
              content: fact,
              expectedRevision: 0,
              idempotencyKey: String(i)
            })
        if (mode === 'learning') {
          await store.capture(
            { ...caller, kind: 'host' },
            {
              session: entry.id,
              events: [
                { seq: 0, kind: 'user-statement', text: entry.training.evidence, successful: false }
              ]
            }
          )
          const candidate = await store.propose(caller, {
            package: entry.training.package,
            evidence: store.evidence(caller).map((e) => e.id)
          })
          await store.validate(caller, candidate)
          const admitted = await store.decide(caller, {
            ...candidate,
            approve: true,
            reason: 'Fixed benchmark training admission'
          })
          procedures = [
            await store.load(caller, candidate.package.name, admitted.publication.active)
          ]
        }
        if (mode !== 'none') recalled = store.read(caller).facts.map((f) => f.content)
        const start = performance.now()
        // Expected output stays outside the driver input. Driver receives the same task and policy in every mode.
        const result = await driver.run(
          safe({
            task: entry.heldOut.input,
            facts: recalled,
            procedures,
            policy: corpus.policy ?? 'No external side effects'
          }),
          { signal: AbortSignal.timeout(60000), maxTokens: 2048 }
        )
        const success = digest(result.answer) === digest(entry.heldOut.expected)
        report.trials.push({
          id: entry.id,
          mode,
          heldOut: true,
          success,
          tokens: result.tokens,
          latencyMs: Math.round(performance.now() - start)
        })
        await store.close()
      } finally {
        await rm(root, { recursive: true, force: true })
      }
    }
  try {
    report.assessment = assessEvaluation(report)
    report.gate = 'passed'
  } catch (e) {
    report.gate = 'failed'
    report.notes.push(e.message)
  }
}
process.stdout.write(JSON.stringify(safe(report), null, 2) + '\n')
