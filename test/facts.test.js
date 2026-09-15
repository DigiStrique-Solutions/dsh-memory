import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './helpers.js'
import { LearningWorker } from '../lib/jobs.js'

test('background learning saves an explicit user fact once with its source evidence', async (t) => {
  const { store, host, caller } = await fixture(t)
  await store.capture(host, {
    session: 'preference',
    events: [
      { seq: 0, kind: 'user-statement', text: 'Use pnpm in this project.', successful: false }
    ]
  })
  const input = {
    content: 'Use pnpm in this project.',
    quote: 'Use pnpm in this project.',
    evidence: [store.evidence(caller)[0].id],
    explicit: true
  }
  await store.proposeFact(host, input)
  await store.proposeFact(host, input)
  assert.equal(store.read(caller).total, 1)
  assert.deepEqual(store.read(caller).facts[0].source.refs, input.evidence)
  assert.equal(store.read(caller).facts[0].source.session, 'preference')
})
test('the learning worker commits explicit facts from a completed review', async (t) => {
  const { store, host, caller } = await fixture(t)
  store.policy.remoteEgress = true
  const statement = 'Preferred language is English.'
  await store.capture(host, {
    session: 'task',
    events: [{ seq: 0, kind: 'user-statement', text: statement, successful: false }]
  })
  await store.scheduleReview(host, { session: 'task', through: 1 })
  const worker = new LearningWorker(store, {
    route: () => ({ provider: 'test', model: 'test' }),
    run: async (input) => ({
      output: {
        candidates: [],
        facts: [
          {
            content: statement,
            quote: statement,
            explicit: true,
            evidence: [input.evidence[0].id]
          }
        ]
      },
      usage: { totalTokens: 100 }
    })
  })
  t.after(() => worker.stop())
  await worker.tick()
  assert.equal(store.read(caller).facts[0]?.content, statement)
  assert.equal(store.stats(caller).budget.used, 100)
})
test('unrelated explicit facts are saved but conflicting and inferred changes await exact review', async (t) => {
  const { store, host, caller } = await fixture(t)
  const statements = [
    'Use pnpm in this project.',
    'Preferred language is English.',
    'Use npm in this project.'
  ]
  await store.capture(host, {
    session: 'preferences',
    events: statements.map((text, seq) => ({
      seq,
      text,
      kind: 'user-statement',
      successful: false
    }))
  })
  const refs = store.evidence(caller)
  for (let i = 0; i < 3; i++)
    await store.proposeFact(host, {
      content: statements[i],
      quote: statements[i],
      evidence: [refs[i].id],
      explicit: true
    })
  assert.equal(store.read(caller).total, 2)
  const conflict = store.reviewFacts(caller).candidates.find((c) => c.content === statements[2])
  assert.equal(conflict.status, 'proposed')
  const inferred = await store.proposeFact(host, {
    content: 'The user prefers TypeScript.',
    evidence: [refs[0].id],
    explicit: false
  })
  assert.equal(inferred.status, 'proposed')
  await assert.rejects(
    store.decideFact(caller, { ...conflict, hash: 'changed', approve: true, reason: 'Review' }),
    { code: 'revision-conflict' }
  )
})

test('revoking factual source withdraws the fact and its dependent procedure', async (t) => {
  const { store, host, caller } = await fixture(t)
  await store.capture(host, {
    session: 'source',
    events: [{ seq: 0, kind: 'user-statement', text: 'Use pnpm.', successful: false }]
  })
  const source = store.evidence(caller)[0].id
  await store.proposeFact(host, { content: 'Use pnpm.', explicit: true, evidence: [source] })
  await store.revokeEvidence(caller, source)
  assert.equal(store.read(caller).total, 0)
  assert.equal(store.read(caller, { status: 'archived' }).total, 1)
  assert.equal(store.reviewFacts(caller).candidates[0].status, 'rejected')
})

test('quoted or hypothetical user text and disabled automatic facts remain review-only', async (t) => {
  const { store, host, caller } = await fixture(t)
  const statement = 'Example: use yarn in the hypothetical project.'
  await store.capture(host, {
    session: 'quote',
    events: [{ seq: 0, kind: 'user-statement', text: statement, successful: false }]
  })
  await store.proposeFact(host, {
    content: statement,
    quote: statement,
    explicit: true,
    evidence: [store.evidence(caller)[0].id]
  })
  assert.equal(store.read(caller).total, 0)
  store.policy.autoFacts = false
  await store.capture(host, {
    session: 'disabled',
    events: [{ seq: 0, kind: 'user-statement', text: 'Use pnpm.', successful: false }]
  })
  await store.proposeFact(host, {
    content: 'Use pnpm.',
    explicit: true,
    evidence: [store.evidence(caller).at(-1).id]
  })
  assert.equal(store.read(caller).total, 0)
})

test('fact review lists summaries and loads full evidence only for the selected proposal', async (t) => {
  const { store, caller, host } = await fixture(t)
  await store.capture(host, {
    session: 'review',
    events: [{ seq: 0, kind: 'user-statement', text: 'Original source text', successful: false }]
  })
  const c = await store.proposeFact(host, {
    content: 'An inference',
    evidence: [store.evidence(caller)[0].id],
    explicit: false
  })
  assert.equal(store.reviewFacts(caller).candidates[0].sources, undefined)
  assert.equal(
    store.reviewFacts(caller, { id: c.id }).candidate.sources[0].text,
    'Original source text'
  )
})
