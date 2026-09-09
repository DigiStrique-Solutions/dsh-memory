import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, evidence, pkg, publish } from './helpers.js'
import { LearningWorker } from '../lib/jobs.js'
import { captureEvents } from '../lib/automation.js'
test('candidate is invisible until exact validated approval; resources and rollback are coherent', async (t) => {
  const { store, caller, host, agent } = await fixture(t),
    refs = await evidence(store, host)
  const c = await store.propose(agent, { package: pkg(), evidence: refs })
  assert.equal(store.catalog(caller).length, 0)
  await assert.rejects(
    store.decide(agent, {
      id: c.id,
      hash: c.hash,
      base: null,
      approve: true,
      reason: 'self approved'
    }),
    { code: 'operator-required' }
  )
  await assert.rejects(
    store.decide(caller, { id: c.id, hash: c.hash, base: null, approve: true, reason: 'reviewed' }),
    { code: 'validation-required' }
  )
  await store.validate(caller, c)
  const first = await store.decide(caller, {
    id: c.id,
    hash: c.hash,
    base: null,
    approve: true,
    reason: 'reviewed'
  })
  assert.deepEqual(
    (await store.load(caller, pkg().name, first.publication.active)).resources,
    pkg().resources
  )
  const second = await publish(store, caller, {
    package: pkg('Run tests twice'),
    evidence: refs,
    base: first.publication.active
  })
  await store.maintain(caller, {
    op: 'rollback',
    name: pkg().name,
    expectedHash: second.publication.active,
    hash: first.publication.active
  })
  assert.equal(store.catalog(caller)[0].hash, first.publication.active)
})
test('stale approvals cannot overwrite newer publication; pinned, protected names and revoked evidence rejected', async (t) => {
  const { store, caller, host } = await fixture(t),
    refs = await evidence(store, host)
  const a = await store.propose(caller, { package: pkg('A'), evidence: refs }),
    b = await store.propose(caller, { package: pkg('B'), evidence: refs })
  await store.validate(caller, a)
  await store.validate(caller, b)
  const p = await store.decide(caller, { ...a, approve: true, reason: 'A' })
  await assert.rejects(store.decide(caller, { ...b, approve: true, reason: 'B' }), {
    code: 'revision-conflict'
  })
  await store.maintain(caller, {
    op: 'pin',
    name: pkg().name,
    expectedHash: p.publication.active,
    pinned: true
  })
  await assert.rejects(
    store.propose(caller, { package: pkg('C'), evidence: refs, base: p.publication.active }),
    { code: 'protected' }
  )
  await assert.rejects(
    store.propose(caller, { package: pkg('evil', 'user-skill'), evidence: refs })
  )
  await store.revokeEvidence(caller, refs[0])
  assert.equal(store.catalog(caller).length, 0)
})
test('capture preserves complete records and seq zero, deduplicates replay and marks unsupported claims', async (t) => {
  const { store, host, caller } = await fixture(t)
  const events = [0, 1, 2].map((seq) => ({
    seq,
    kind: 'assistant-claim',
    text: 'x'.repeat(16000),
    successful: false
  }))
  const first = await store.capture(host, { session: 's', events })
  assert.equal(first.cursor, 2)
  assert.equal(first.included, 2)
  const second = await store.capture(host, { session: 's', events })
  assert.equal(second.cursor, 3)
  assert.equal(store.evidence(host).length, 3)
  const c = await store.propose(caller, { package: pkg(), evidence: [store.evidence(host)[0].id] })
  assert.equal(c.trust, 'unverified')
})
test('Host event adapter preserves user/tool trust and excludes learning output', () => {
  const events = [
    {
      seq: 0,
      type: 'user/message',
      data: { source: { kind: 'user' }, content: [{ type: 'text', text: 'Correction' }] }
    },
    {
      seq: 1,
      type: 'user/message',
      data: { source: { kind: 'plugin' }, content: [{ type: 'text', text: 'Injected memory' }] }
    },
    { seq: 2, type: 'tool/call', data: { callId: 'c', name: 'run_command' } },
    {
      seq: 3,
      type: 'tool/result',
      data: {
        message: {
          content: [
            {
              type: 'tool-result',
              toolCallId: 'c',
              isError: false,
              content: [{ type: 'text', text: 'tests pass' }]
            }
          ]
        }
      }
    },
    { seq: 4, type: 'tool/call', data: { callId: 'd', name: 'memory_read' } },
    {
      seq: 5,
      type: 'tool/result',
      data: {
        message: {
          content: [
            {
              type: 'tool-result',
              toolCallId: 'd',
              content: [{ type: 'text', text: 'old memory' }]
            }
          ]
        }
      }
    }
  ]
  const out = captureEvents(events)
  assert.equal(out.length, 2)
  assert.equal(out[1].kind, 'tool-result')
  assert.equal(out[1].successful, true)
})
test('durable jobs persist unavailable routes, budget reservations and resume after restart', async (t) => {
  const { store, host, caller } = await fixture(t)
  await evidence(store, host)
  store.policy.remoteEgress = true
  let available = false
  const worker = new LearningWorker(store, {
    route: () => (available ? { provider: 'test', model: 'test' } : null),
    run: async (input) => ({
      candidates: [{ package: pkg(), evidence: input.evidence.map((e) => e.id) }],
      tokens: 100
    })
  })
  await worker.tick()
  assert.equal(store.stats(caller).jobs[0].error, 'model-route-unavailable')
  available = true
  await store.commit(host, 'capture', (s) => {
    s.jobs[0].nextAt = 0
  })
  await worker.tick()
  assert.equal(store.stats(caller).jobs[0].state, 'done')
  assert.equal(store.review(caller).candidates.length, 1)
  assert.equal(store.catalog(caller).length, 0)
  assert.ok(store.stats(caller).budget.reserved > 100)
  await worker.stop()
})
test('hung and late provider cannot write after worker stop; recovery retains reservation', async (t) => {
  const { store, host, caller } = await fixture(t)
  await evidence(store, host)
  store.policy.remoteEgress = true
  let resolve, started
  const ready = new Promise((r) => (started = r))
  const worker = new LearningWorker(store, {
    route: () => ({ provider: 'test', model: 'test' }),
    run: () => {
      started()
      return new Promise((r) => (resolve = r))
    }
  })
  const run = worker.tick()
  await ready
  await worker.stop()
  await run
  resolve({ candidates: [{ package: pkg(), evidence: store.evidence(host).map((e) => e.id) }] })
  await new Promise((r) => setImmediate(r))
  assert.equal(store.review(caller).candidates.length, 0)
  const reservation = store.stats(caller).budget.reserved
  const next = new LearningWorker(store, { route: () => null })
  await next.recover()
  assert.equal(store.stats(caller).jobs[0].state, 'pending')
  assert.equal(store.stats(caller).budget.reserved, reservation)
  await next.stop()
})
test('exposure is distinct from human-reviewed outcome and cannot be self-certified', async (t) => {
  const { store, caller, host, agent } = await fixture(t),
    refs = await evidence(store, host),
    p = await publish(store, caller, { package: pkg(), evidence: refs })
  const args = {
    name: pkg().name,
    hash: p.publication.active,
    session: 'task2',
    evidence: [refs[1]]
  }
  await store.outcome(agent, { ...args, kind: 'exposure' })
  await assert.rejects(store.outcome(agent, { ...args, kind: 'success' }), {
    code: 'operator-required'
  })
  await store.outcome(caller, { ...args, kind: 'success' })
  assert.equal(store.state(caller).outcomes.length, 2)
})
