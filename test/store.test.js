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
