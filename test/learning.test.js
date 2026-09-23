import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, evidence, pkg, publish } from './helpers.js'
import { LearningWorker } from '../lib/jobs.js'
import { captureEvents } from '../lib/automation.js'
test('capture does not extract until the completed turn is scheduled, including replay', async (t) => {
  const { store, host, caller } = await fixture(t)
  await store.capture(host, {
    session: 'task',
    events: [{ seq: 0, kind: 'user-statement', text: 'Check this project', successful: false }]
  })
  assert.equal(store.stats(caller).jobs.length, 0)
  await store.capture(host, {
    session: 'task',
    events: [{ seq: 2, kind: 'tool-result', text: 'test: passed', successful: true }],
    scannedTo: 4
  })
  await store.scheduleReview(host, { session: 'task', through: 4, reason: 'completed' })
  assert.equal(store.stats(caller).jobs.length, 1)
  await store.scheduleReview(host, { session: 'task', through: 4, reason: 'completed' })
  assert.equal(store.stats(caller).jobs.length, 1)
})
test('expired learning work terminates even when evidence egress is disabled', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: 1800000000000 })
  const { store, host, caller } = await fixture(t)
  await evidence(store, host)
  t.mock.timers.setTime(Date.now() + 8 * 86400000)
  const worker = new LearningWorker(store, { route: () => null })
  t.after(() => worker.stop())
  await worker.tick()
  assert.equal(store.stats(caller).jobs[0].state, 'failed')
  assert.equal(store.stats(caller).jobs[0].error, 'deadline-or-attempt-limit')
})
test('oversized review input terminates explicitly and does not starve a smaller job', async (t) => {
  const { store, host, caller } = await fixture(t)
  store.policy.remoteEgress = true
  await store.capture(host, {
    session: 'large',
    events: [{ seq: 0, kind: 'user-statement', text: 'x'.repeat(16000), successful: false }]
  })
  await store.scheduleReview(host, { session: 'large', through: 1 })
  await evidence(store, host)
  const worker = new LearningWorker(store, {
    route: () => ({ provider: 'test', model: 'test' }),
    run: async () => ({ candidates: [] })
  })
  t.after(() => worker.stop())
  await worker.tick()
  assert.equal(store.stats(caller).jobs[0].error, 'input-budget-exceeded')
  assert.equal(store.stats(caller).jobs[0].state, 'failed')
  await worker.tick()
  assert.equal(store.stats(caller).jobs[1].state, 'done')
})
test('learning accounting reports unknown usage instead of trusting model-authored token counts', async (t) => {
  const { store, host, caller } = await fixture(t)
  store.policy.remoteEgress = true
  await evidence(store, host)
  const worker = new LearningWorker(store, {
    route: () => ({ provider: 'test', model: 'test' }),
    run: async () => ({ output: { candidates: [], tokens: 1 }, usage: null })
  })
  t.after(() => worker.stop())
  await worker.tick()
  const status = store.stats(caller)
  assert.equal(status.jobs[0].state, 'done')
  assert.equal(status.budget.unknown, 1)
  assert.equal(status.budget.used, 0)
  assert.ok(status.budget.reserved > 0)
})
test('refinement can preserve the existing package and bind its factual dependencies', async (t) => {
  const { store, host, caller } = await fixture(t)
  const refs = await evidence(store, host)
  const fact = await store.mutate(caller, {
    op: 'add',
    content: 'Run npm test',
    expectedRevision: 0,
    idempotencyKey: 'fact'
  })
  const original = await publish(store, caller, {
    package: pkg('Preserve this prerequisite.'),
    evidence: refs
  })
  store.policy.remoteEgress = true
  const worker = new LearningWorker(store, {
    route: () => ({ provider: 'test', model: 'test' }),
    run: async (input) => ({
      output: {
        candidates: [
          {
            package: {
              ...input.baseSkills[0].package,
              content: input.baseSkills[0].package.content + '\nCheck the new regression.'
            },
            base: input.baseSkills[0].hash,
            evidence: refs,
            facts: input.facts.map((f) => ({ id: f.id, revision: f.revision }))
          }
        ]
      }
    })
  })
  t.after(() => worker.stop())
  await worker.tick()
  const proposal = store
    .review(caller)
    .candidates.find((c) => c.base === original.publication.active)
  assert.ok(proposal?.package.content.includes('Preserve this prerequisite.'))
  assert.deepEqual(proposal.facts, [{ id: fact.id, revision: fact.revision }])
})
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
    session: 'session-1',
    evidence: [refs[1]]
  }
  await store.outcome(agent, { ...args, kind: 'exposure' })
  await assert.rejects(store.outcome(agent, { ...args, kind: 'success' }), {
    code: 'operator-required'
  })
  await store.outcome(caller, { ...args, kind: 'success' })
  assert.equal(store.state(caller).outcomes.length, 2)
})
test('outcomes cannot certify a skill using evidence from another session', async (t) => {
  const { store, caller, host, agent } = await fixture(t)
  const refs = await evidence(store, host)
  const publication = await publish(store, caller, { package: pkg(), evidence: refs })
  const use = { name: pkg().name, hash: publication.publication.active, session: 'later-task' }
  await store.outcome(agent, { ...use, kind: 'exposure' })
  await assert.rejects(store.outcome(caller, { ...use, kind: 'success', evidence: [refs[1]] }), {
    code: 'evidence-required'
  })
})
test('a reviewed failure schedules one refinement against the exposed revision', async (t) => {
  const { store, caller, host, agent } = await fixture(t)
  const refs = await evidence(store, host)
  const p = await publish(store, caller, { package: pkg(), evidence: refs })
  const use = { name: pkg().name, hash: p.publication.active, session: 'session-1' }
  await store.outcome(agent, { ...use, kind: 'exposure' })
  await store.outcome(caller, { ...use, kind: 'failure', evidence: [refs[1]] })
  await store.outcome(caller, { ...use, kind: 'failure', evidence: [refs[1]] })
  const refinements = store.stats(caller).jobs.filter((j) => j.reason === 'reviewed-failure')
  assert.equal(refinements.length, 1)
  assert.equal(refinements[0].target.hash, p.publication.active)
})

test('capture pairs tool arguments and marks missing context without recycling learned bodies', () => {
  const result = (seq, id, text) => ({
    seq,
    type: 'tool/result',
    data: {
      message: {
        content: [{ type: 'tool-result', toolCallId: id, content: [{ type: 'text', text }] }]
      }
    }
  })
  const events = captureEvents([
    {
      seq: 0,
      type: 'tool/call',
      data: { callId: 'call', name: 'run_command', arguments: { command: 'npm test' } }
    },
    result(1, 'call', 'passed'),
    result(2, 'missing', 'unknown'),
    { seq: 3, type: 'tool/call', data: { callId: 'skill', name: 'skill' } },
    result(4, 'skill', 'A learned procedure'),
    { seq: 5, type: 'turn/end', data: { reason: { kind: 'canceled' } } }
  ])
  assert.match(events[0].text, /npm test/)
  assert.match(events[1].text, /Missing tool call context/)
  assert.equal(
    events.some((e) => e.text.includes('A learned procedure')),
    false
  )
  assert.match(events.at(-1).text, /canceled/)
  assert.equal(events.at(-1).kind, 'turn-boundary')
})

test('long completed turns schedule bounded contiguous parts without replay duplicates', async (t) => {
  const { store, host, caller } = await fixture(t)
  for (let batch = 0; batch < 3; batch++)
    await store.capture(host, {
      session: 'long',
      events: Array.from({ length: 30 }, (_, i) => ({
        seq: batch * 30 + i,
        kind: 'user-statement',
        text: 'Step ' + i,
        successful: false
      }))
    })
  await store.scheduleReview(host, { session: 'long', through: 90 })
  const status = store.stats(caller)
  assert.equal(status.jobTotal, 2)
  assert.equal(status.jobs[0].from, 0)
  assert.equal(status.jobs[0].to, status.jobs[1].from)
  assert.equal(status.jobs[1].to, 90)
  await store.scheduleReview(host, { session: 'long', through: 90 })
  assert.equal(store.stats(caller).jobTotal, 2)
})

test('a route failure in one scope does not prevent the next scope from learning', async (t) => {
  const { store, host, caller } = await fixture(t)
  store.policy.remoteEgress = true
  await evidence(store, host)
  const other = { ...host, scope: 'global', root: '' }
  await evidence(store, other)
  let routes = 0,
    calls = 0
  const worker = new LearningWorker(store, {
    route: () => {
      if (++routes === 1) throw new Error('route unavailable')
      return { provider: 'test', model: 'test' }
    },
    run: async () => {
      calls++
      return { candidates: [] }
    }
  })
  t.after(() => worker.stop())
  await worker.tick()
  assert.equal(calls, 1)
  assert.equal(store.stats({ ...caller, scope: 'global' }).jobs[0].state, 'done')
  assert.equal(store.stats(caller).jobs[0].error, 'scope-unavailable')
})

test('an unchanged published package does not create another actionable review', async (t) => {
  const { store, host, caller } = await fixture(t)
  const refs = await evidence(store, host)
  const active = await publish(store, caller, { package: pkg(), evidence: refs })
  await store.propose(caller, { package: pkg(), evidence: refs, base: active.publication.active })
  assert.equal(store.review(caller).total, 1)
})

test('maintenance schedules one bounded review for an aged active revision', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: 1800000000000 })
  const { store, caller, host } = await fixture(t)
  const refs = await evidence(store, host)
  const active = await publish(store, caller, { package: pkg(), evidence: refs })
  t.mock.timers.tick(91 * 86400000)
  await store.maintenance(caller)
  const jobs = store.stats(caller).jobs.filter((j) => j.reason === 'maintenance')
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].target.hash, active.publication.active)
  await store.maintenance(caller)
  assert.equal(store.stats(caller).jobs.filter((j) => j.reason === 'maintenance').length, 1)
})

test(
  'more than 1000 review cycles remain bounded and replay stays settled after a disk reopen',
  { timeout: 120000 },
  async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: 1800000000000 })
    const { root, store, caller, host } = await fixture(t)
    store.policy.remoteEgress = true
    const worker = new LearningWorker(
      store,
      {
        route: () => ({ provider: 'test', model: 'test' }),
        run: async () => ({ output: { candidates: [] }, usage: { totalTokens: 20 } })
      },
      { dailyTokens: 1000000 }
    )
    t.after(() => worker.stop())
    for (let seq = 0; seq < 1005; seq++) {
      if (seq && seq % 200 === 0) t.mock.timers.tick(86400000)
      await store.capture(host, {
        session: 'cycles',
        events: [{ seq, kind: 'user-statement', text: 'No reusable lesson', successful: false }]
      })
      await store.scheduleReview(host, { session: 'cycles', through: seq + 1 })
      await worker.tick()
    }
    assert.equal(store.stats(caller).jobCounts.pending, 0)
    assert.ok(store.stats(caller).jobTotal <= 101)
    await worker.stop()
    await store.close()
    const { FileBackend, Objects } = await import('../lib/files.js')
    const { MemoryStore } = await import('../lib/store.js')
    const backend = new FileBackend(root)
    await backend.init()
    const reopened = new MemoryStore(backend, new Objects(root))
    t.after(() => reopened.close())
    assert.equal(
      (await reopened.scheduleReview(host, { session: 'cycles', through: 1005 })).scheduled,
      false
    )
  }
)

test('provider usage is accounted even when its procedure response is invalid', async (t) => {
  const { store, caller, host } = await fixture(t)
  store.policy.remoteEgress = true
  await evidence(store, host)
  const worker = new LearningWorker(store, {
    route: () => ({ provider: 'test', model: 'test' }),
    run: async () => ({ output: { candidates: 'invalid' }, usage: { totalTokens: 123 } })
  })
  t.after(() => worker.stop())
  await worker.tick()
  assert.equal(store.stats(caller).budget.used, 123)
  assert.equal(store.stats(caller).budget.unknown, 0)
  assert.equal(store.stats(caller).jobs[0].state, 'pending')
})
