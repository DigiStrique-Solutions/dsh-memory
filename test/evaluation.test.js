import test from 'node:test'
import assert from 'node:assert/strict'
import { assessEvaluation, SAFETY_CASES } from '../lib/evaluation.js'
import { fixture, evidence, pkg } from './helpers.js'
const report = () => ({
  format: 'strique-memory-evaluation',
  version: 1,
  liveModel: true,
  model: 'synthetic-test-driver',
  corpusHash: 'a'.repeat(64),
  safety: SAFETY_CASES.map((name) => ({ name, passed: true })),
  trials: ['none', 'memory', 'learning'].flatMap((mode) =>
    Array.from({ length: 30 }, (_, i) => ({
      id: 'trial' + i,
      mode,
      heldOut: true,
      success: mode === 'learning' || i < 20,
      tokens: 100,
      latencyMs: 20
    }))
  )
})
test('evaluation gate requires paired held-out improvements, real model evidence and all safety fixtures', () => {
  assert.equal(assessEvaluation(report()).wins, 10)
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
