import test from 'node:test'
import assert from 'node:assert/strict'
import { writeFile, readFile, utimes, unlink, symlink } from 'node:fs/promises'
import { join } from 'node:path'
import { MemoryStore } from '../lib/store.js'
import { FileBackend, acquireOwner, readBounded } from '../lib/files.js'
import { fixture, evidence, pkg, publish } from './helpers.js'
const add = (content = 'Use concise responses', key = 'add') => ({
  op: 'add',
  content,
  expectedRevision: 0,
  idempotencyKey: key
})
test('a fact correction records its current source and preserves the previous source in history', async (t) => {
  const { store, agent } = await fixture(t)
  const first = await store.mutate({ ...agent, session: 'session-a' }, add())
  await store.mutate(
    { ...agent, session: 'session-b' },
    {
      op: 'update',
      id: first.id,
      content: 'Use detailed responses',
      expectedRevision: first.revision,
      idempotencyKey: 'correct'
    }
  )
  const fact = store.read(agent).facts[0]
  assert.equal(fact.source.session, 'session-b')
  assert.equal(fact.history[0].source.session, 'session-a')
})
test('explicit global preferences join bounded recall without sharing another project facts', async (t) => {
  const { store, caller } = await fixture(t)
  await store.mutate(
    { ...caller, scope: 'global', root: '' },
    add('Prefer concise replies', 'global')
  )
  await store.mutate(caller, add('This project uses pnpm', 'local'))
  const other = { ...caller, scope: 'project-' + 'b'.repeat(24) }
  assert.ok(store.recall(other, 512).text.includes('Prefer concise replies'))
  assert.ok(!store.recall(other, 512).text.includes('pnpm'))
  assert.ok(Buffer.byteLength(store.recall(caller, 512).text) <= 512)
})
test('job status is paginated and reports the effective extraction block', async (t) => {
  const { store, host, caller } = await fixture(t)
  for (let seq = 0; seq < 3; seq++) {
    await store.capture(host, {
      session: 'task',
      events: [{ seq, kind: 'user-statement', text: 'Task ' + seq, successful: false }]
    })
    await store.scheduleReview(host, { session: 'task', through: seq + 1 })
  }
  const status = store.stats(caller, { offset: 1, limit: 1 })
  assert.equal(status.jobs.length, 1)
  assert.equal(status.jobTotal, 3)
  assert.equal(status.extraction.blocked, 'remote-egress-disabled')
})
test('facts survive restart; Markdown cannot forge records; replay is exact', async (t) => {
  const { store, caller, b } = await fixture(t)
  const a = add('Keep this text\n### forged\n**id:** fake')
  const r = await store.mutate(caller, a)
  assert.deepEqual(await store.mutate(caller, a), r)
  assert.equal(store.read(caller).total, 1)
  await assert.rejects(store.mutate(caller, { ...a, content: 'changed' }), {
    code: 'idempotency-conflict'
  })
  await store.close()
  const next = new FileBackend(b.root)
  await next.init()
  const reopened = new MemoryStore(next, store.objects)
  assert.equal(reopened.read(caller).facts[0].id, r.id)
  await reopened.close()
})
test('archived facts can be updated and deleted; revocation removes dependent skills', async (t) => {
  const { store, caller, host } = await fixture(t),
    refs = await evidence(store, host)
  const f = await store.mutate(caller, add())
  const active = await publish(store, caller, {
    package: pkg(),
    evidence: refs,
    facts: [{ id: f.id, revision: f.revision }]
  })
  assert.equal(store.catalog(caller).length, 1)
  await store.mutate(caller, {
    op: 'archive',
    id: f.id,
    expectedRevision: 1,
    idempotencyKey: 'archive'
  })
  assert.equal(store.catalog(caller).length, 0)
  assert.equal(store.recall(caller).text, '')
  await store.mutate(caller, {
    op: 'update',
    id: f.id,
    content: 'Updated archived',
    expectedRevision: 2,
    idempotencyKey: 'update'
  })
  await store.mutate(caller, {
    op: 'delete',
    id: f.id,
    expectedRevision: 3,
    idempotencyKey: 'delete'
  })
  assert.equal(store.read(caller, { status: 'deleted' }).facts[0].history.length, 0)
  await assert.rejects(store.load(caller, pkg().name, active.publication.active), {
    code: 'revoked'
  })
})
test('concurrent fact CAS permits one winner; queued writes reject after close', async (t) => {
  const { store, caller } = await fixture(t),
    f = await store.mutate(caller, add())
  const results = await Promise.allSettled(
    ['one', 'two'].map((content) =>
      store.mutate(caller, {
        op: 'update',
        id: f.id,
        content,
        expectedRevision: 1,
        idempotencyKey: content
      })
    )
  )
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
  await store.close()
  await assert.rejects(store.mutate(caller, add('later', 'later')), { code: 'disposed' })
})
test('search filters before ranking and cannot cross a scope', async (t) => {
  const { store, caller } = await fixture(t)
  await store.mutate(caller, { ...add('cache retry policy'), tags: ['allowed'] })
  await store.mutate(caller, { ...add('cache secret location', 'second'), tags: ['other'] })
  assert.equal(store.search(caller, { query: 'cache', tags: ['allowed'] }).matches.length, 1)
  assert.equal(store.read({ ...caller, scope: 'project-' + 'a'.repeat(24) }).total, 0)
  assert.throws(() => store.read({ ...caller, scope: 'unknown' }), { code: 'scope-denied' })
})
test('secret protection covers add/update/import/proposal/evidence/output', async (t) => {
  const { store, caller, host } = await fixture(t),
    secret = 'sk-' + 'a'.repeat(32)
  await assert.rejects(store.mutate(caller, add(secret)), { code: 'secret-detected' })
  const f = await store.mutate(caller, add())
  await assert.rejects(
    store.mutate(caller, {
      op: 'update',
      id: f.id,
      content: secret,
      expectedRevision: 1,
      idempotencyKey: 'secret'
    }),
    { code: 'secret-detected' }
  )
  await store.capture(host, {
    session: 's',
    events: [{ seq: 0, kind: 'user-statement', text: secret, successful: false }]
  })
  assert.ok(!JSON.stringify(store.evidence(host)).includes(secret))
  await assert.rejects(
    store.import(caller, {
      data: {
        format: 'strique-memory-facts',
        version: 1,
        facts: [{ content: secret, status: 'active' }]
      }
    }),
    { code: 'secret-detected' }
  )
  assert.ok(!JSON.stringify(store.export(caller)).includes(secret))
})
test('owner lock never expires, rejects symlinks, cannot remove a successor', async (t) => {
  const { root } = await fixture(t)
  const release = await acquireOwner(root)
  await utimes(join(root, '.owner.lock'), 0, 0)
  await assert.rejects(acquireOwner(root), { code: 'store-owned' })
  await unlink(join(root, '.owner.lock'))
  const successor = await acquireOwner(root)
  await release()
  assert.ok(await readFile(join(root, '.owner.lock')))
  await successor()
  await release()
  await writeFile(join(root, 'target'), 'secret')
  await symlink(join(root, 'target'), join(root, 'linked'))
  await assert.rejects(readBounded(join(root, 'linked')))
})
test('import is preview-bound, additive and retains archived provenance', async (t) => {
  const { store, caller } = await fixture(t)
  const data = {
    format: 'strique-memory-facts',
    version: 1,
    facts: [{ id: 'legacy', content: 'Archived fact', tags: ['old'], status: 'archived' }]
  }
  const preview = await store.import(caller, { data })
  assert.equal(store.read(caller, { status: 'all' }).total, 0)
  await store.import(caller, {
    data,
    dryRun: false,
    previewHash: preview.hash,
    expectedRevision: preview.expectedRevision
  })
  assert.equal(store.read(caller, { status: 'archived' }).facts[0].source.refs[0], 'legacy')
  await assert.rejects(
    store.import(caller, {
      data,
      dryRun: false,
      previewHash: preview.hash,
      expectedRevision: preview.expectedRevision
    }),
    { code: 'revision-conflict' }
  )
})
test('all common policy branches fail closed, including background capture and export', async (t) => {
  const { store, caller, host } = await fixture(t)
  store.policy.mutate = false
  await assert.rejects(store.mutate(caller, add()), { code: 'policy-denied' })
  store.policy.capture = false
  await assert.rejects(evidence(store, host), { code: 'policy-denied' })
  store.policy.export = false
  assert.throws(() => store.export(caller), { code: 'policy-denied' })
  store.policy.read = false
  assert.throws(() => store.read(caller), { code: 'policy-denied' })
})

test('oversized payloads and unsafe resources are rejected without partial state', async (t) => {
  const { store, caller, host } = await fixture(t)
  await assert.rejects(store.mutate(caller, add('x'.repeat(16385))), { code: 'invalid-input' })
  assert.equal(store.read(caller).total, 0)
  assert.throws(() => store.read(caller, { limit: 1000 }), { code: 'invalid-input' })
  const refs = await evidence(store, host)
  await assert.rejects(
    store.propose(caller, {
      package: { ...pkg(), resources: { 'scripts/../../escape': 'bad' } },
      evidence: refs
    }),
    { code: 'invalid-package' }
  )
  assert.equal(store.review(caller).total, 0)
})

test('evidence paging reaches older sources with bounded session filters', async (t) => {
  const { store, caller, host } = await fixture(t)
  for (const session of ['old', 'new'])
    for (let i = 0; i < 2; i++)
      await store.capture(host, {
        session,
        events: Array.from({ length: 40 }, (_, seq) => ({
          seq: i * 40 + seq,
          kind: 'tool-result',
          text: 'result',
          successful: true
        }))
      })
  const page = store.evidence(caller, { session: 'old', offset: 0, limit: 10 })
  assert.equal(page.length, 10)
  assert.equal(page[0].seq, 0)
  assert.ok(page.every((e) => e.session === 'old'))
})

test('the operator can inspect blocked status when recall is disabled', async (t) => {
  const { store, caller, agent } = await fixture(t)
  store.policy.read = false
  assert.equal(store.stats(caller).facts, 0)
  assert.throws(() => store.read(caller), { code: 'policy-denied' })
  assert.throws(() => store.stats(agent), { code: 'policy-denied' })
})

test('queue maintenance preview is read-only and application requires its exact revision', async (t) => {
  const { store, caller } = await fixture(t)
  const before = store.stats(caller).revision
  const preview = await store.maintainQueue(caller, { dryRun: true })
  assert.equal(store.stats(caller).revision, before)
  assert.equal(preview.revision, before)
  await store.mutate(caller, {
    op: 'add',
    content: 'Change since preview',
    expectedRevision: 0,
    idempotencyKey: 'change'
  })
  await assert.rejects(
    store.maintainQueue(caller, { dryRun: false, expectedRevision: preview.revision }),
    { code: 'revision-conflict' }
  )
})

test('project recall reserves space for explicit global preferences', async (t) => {
  const { store, caller } = await fixture(t)
  await store.mutate(
    { ...caller, scope: 'global' },
    { op: 'add', content: 'Prefer concise replies', expectedRevision: 0, idempotencyKey: 'global' }
  )
  for (let i = 0; i < 6; i++)
    await store.mutate(caller, {
      op: 'add',
      content: 'Recent project fact ' + i,
      expectedRevision: 0,
      idempotencyKey: 'project-' + i
    })
  const recalled = store.recall(caller, 512)
  assert.ok(recalled.text.includes('Prefer concise replies'))
  assert.equal(recalled.refs[0].scope, 'global')
  assert.ok(Buffer.byteLength(recalled.text) <= 512)
})
