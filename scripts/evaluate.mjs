#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { digest, safe } from '../lib/policy.js'
import { assessEvaluation, MODES } from '../lib/evaluation.js'
import { evaluateSessionCase } from './session-evaluation.mjs'
const args = process.argv.slice(2)
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined)
const driverPath = option('--driver'),
  corpusPath = option('--corpus')
const output = execFileSync(
  process.execPath,
  [
    '--test',
    '--test-reporter=tap',
    ...(await readdir('test')).filter((f) => f.endsWith('.test.js')).map((f) => 'test/' + f)
  ],
  { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }
)
const passed = [...output.matchAll(/^ok \d+ - (.+)$/gm)].map((m) => m[1])
const fixtures = {
  'scope-isolation': 'search filters before ranking',
  'secret-screening': 'secret protection covers',
  'stale-approval': 'stale approvals cannot',
  'writer-ownership': 'owner lease leaves no file',
  revocation: 'revoking factual source',
  cancellation: 'hung and late provider',
  replay: 'capture does not extract',
  restart: 'facts survive restart',
  'protected-skills': 'stale approvals cannot',
  resources: 'candidate is invisible until',
  authentication: 'HTTP requires actual auth',
  migration: 'a frozen v1 snapshot',
  'evidence-trust': 'Host event adapter',
  'output-bounds': 'oversized payloads',
  'publication-rollback': 'candidate is invisible until'
}
const safety = Object.entries(fixtures).map(([name, prefix]) => {
  const tests = passed.filter((t) => t.startsWith(prefix))
  return { name, passed: tests.length > 0, tests }
})
const report = {
  format: 'strique-memory-evaluation',
  version: 2,
  protocol: 'session-learning-v2',
  liveModel: false,
  model: 'scripted correctness only',
  corpusHash: digest(output),
  safety,
  trials: [],
  repetitions: [],
  gate: 'not-evaluated',
  notes: [
    'Deterministic correctness is not evidence of performance gain. Unattended admission remains disabled.'
  ]
}
if (safety.some((s) => !s.passed))
  throw new Error('A required named safety fixture did not execute')
if (driverPath || corpusPath) {
  if (!driverPath || !corpusPath) throw new Error('Provide both --driver and --corpus')
  const driver = await import(pathToFileURL(resolve(driverPath)).href)
  const corpus = safe(JSON.parse(await readFile(corpusPath, 'utf8')))
  if (
    typeof driver.stream !== 'function' ||
    typeof driver.run !== 'function' ||
    !driver.model ||
    typeof driver.liveModel !== 'boolean'
  )
    throw new Error('Driver must implement stream, run, model and liveModel')
  if (
    !Array.isArray(corpus.cases) ||
    corpus.cases.length < 30 ||
    corpus.cases.length > 100 ||
    new Set(corpus.cases.map((c) => c.id)).size !== corpus.cases.length ||
    !Number.isInteger(corpus.repetitions) ||
    corpus.repetitions < 2 ||
    corpus.repetitions > 5
  )
    throw new Error('Provide 30 to 100 distinct cases and 2 to 5 independent repetitions')
  report.model = driver.model
  report.liveModel = driver.liveModel
  report.corpusHash = digest(corpus)
  report.repetitions = Array.from({ length: corpus.repetitions }, (_, i) => i)
  for (const repetition of report.repetitions)
    for (const entry of corpus.cases)
      for (const mode of MODES) {
        const { configuration, ...trial } = await evaluateSessionCase({
          driver,
          entry,
          mode,
          config: corpus.extraction,
          repetition
        })
        if (report.configuration && digest(configuration) !== report.configurationHash)
          throw new Error('Evaluation configuration changed')
        report.configuration = configuration
        report.configurationHash = digest(configuration)
        report.trials.push(trial)
      }
  report.cost = Object.fromEntries(
    MODES.map((mode) => {
      const trials = report.trials.filter((t) => t.mode === mode)
      const extraction = trials.some((t) => t.extractionTokens === null)
        ? null
        : trials.reduce((n, t) => n + t.extractionTokens, 0)
      const future = trials.some((t) => t.tokens === null)
        ? null
        : trials.reduce((n, t) => n + t.tokens, 0)
      return [
        mode,
        {
          extractionTokens: extraction,
          futureTokens: future,
          totalTokens: extraction === null || future === null ? null : extraction + future
        }
      ]
    })
  )
  try {
    report.assessment = assessEvaluation(report)
    report.gate = 'passed'
  } catch (e) {
    report.gate = 'failed'
    report.notes.push(e.message)
    process.exitCode = 1
  }
}
process.stdout.write(JSON.stringify(safe(report), null, 2) + '\n')
