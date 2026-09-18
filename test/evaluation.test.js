import test from 'node:test'
import assert from 'node:assert/strict'
import { assessEvaluation, SAFETY_CASES, evaluationConfiguration } from '../lib/evaluation.js'
import { digest, DEFAULT_POLICY } from '../lib/policy.js'
import { fixture, evidence, pkg } from './helpers.js'
const report = (configuration = evaluationConfiguration(DEFAULT_POLICY, { route: null })) => ({
  configuration,
  configurationHash: digest(configuration),
  protocol: 'session-learning-v2',
  repetitions: [0, 1],
  format: 'strique-memory-evaluation',
  version: 2,
  liveModel: true,
  model: 'synthetic-test-driver',
  corpusHash: 'a'.repeat(64),
  safety: SAFETY_CASES.map((name) => ({ name, passed: true })),
  trials: ['none', 'memory', 'learning'].flatMap((mode) =>
    Array.from({ length: 60 }, (_, i) => ({
      id: 'trial' + i,
      repetition: Math.floor(i / 30),
      oracle: 'withheld-exact',
      trainingFrozen: true,
      sessionProtocol: 'harness',
      extractionTokens: 100,
      mode,
      heldOut: true,
      success: mode === 'learning' || i % 30 < 20,
      tokens: 100,
      latencyMs: 20
    }))
  )
})
test('evaluation gate requires paired held-out improvements, real model evidence and all safety fixtures', () => {
  assert.equal(assessEvaluation(report()).wins, 20)
  assert.throws(() => assessEvaluation({ ...report(), liveModel: false }), {
    code: 'evaluation-required'
  })
  const regression = report()
  regression.trials.find((t) => t.mode === 'learning').success = false
  assert.throws(() => assessEvaluation(regression), { code: 'evaluation-required' })
  assert.throws(() => assessEvaluation({ ...report(), safety: [] }), {
    code: 'evaluation-required'
  })
})
test('autonomy needs an explicit operator gate; unverified claims never auto-activate', async (t) => {
  const { store, caller, host, agent } = await fixture(t),
    refs = await evidence(store, host)
  const c = await store.propose(agent, { package: pkg(), evidence: refs })
  await store.autoAdmit(host)
  assert.equal(store.catalog(caller).length, 0)
  await assert.rejects(
    store.configureAutonomy(agent, {
      enabled: true,
      report: report(),
      classes: ['user-supported']
    }),
    { code: 'operator-required' }
  )
  await store.configureAutonomy(caller, {
    enabled: true,
    report: report(),
    classes: ['user-supported']
  })
  await store.autoAdmit(host)
  assert.equal(store.catalog(caller).length, 1)
  assert.equal(store.review(caller, { id: c.id }).candidate.decision.actor, 'evaluated-policy')
})

test('a supplied-procedure benchmark cannot authorize unattended learning', () => {
  assert.throws(() => assessEvaluation({ ...report(), protocol: 'supplied-procedure' }), {
    code: 'evaluation-required'
  })
})

test('changing factual learning policy invalidates a previous admission gate', async (t) => {
  const { store, caller, host } = await fixture(t)
  const refs = await evidence(store, host)
  await store.configureAutonomy(caller, {
    enabled: true,
    report: report(store.evaluationConfiguration()),
    classes: ['user-supported']
  })
  store.policy.autoFacts = false
  await store.propose(host, { package: pkg(), evidence: refs })
  await store.autoAdmit(host)
  assert.equal(store.catalog(caller).length, 0)
  assert.equal(store.stats(caller).autonomy.effective, false)
})
