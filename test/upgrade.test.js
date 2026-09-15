import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, writeFile, access } from 'node:fs/promises'
import { join } from 'node:path'
import { fixture } from './helpers.js'
import { FileBackend, Objects } from '../lib/files.js'
import { MemoryStore } from '../lib/store.js'
import { upgradeSnapshot } from '../lib/upgrade.js'
import { evidence } from './helpers.js'

test('a frozen v1 snapshot upgrades separately and preserves fact identities and replay', async (t) => {
  const { root, caller, store } = await fixture(t)
  const args = { op: 'add', content: 'Use pnpm', expectedRevision: 0, idempotencyKey: 'original' }
  const receipt = await store.mutate(caller, args)
  await store.close()
  const source = join(root, 'state.json')
  const original = await readFile(source, 'utf8')
  // The fixture describes the legacy storage input, independently of the new writer.
  const rows = JSON.parse(original)
  for (const [, state] of rows) {
    state.schema = 1
    delete state.factCandidates
    delete state.scheduled
    delete state.settled
    delete state.budget.unknown
    delete state.autonomy.configurationHash
  }
  await writeFile(source, JSON.stringify(rows))
  const frozen = await readFile(source, 'utf8')
  const destination = join(root, 'upgraded')
  const result = await upgradeSnapshot({ source, objects: join(root, 'objects'), destination })
  assert.equal(result.scopes, 1)
  assert.equal(await readFile(source, 'utf8'), frozen)
  const backend = new FileBackend(destination)
  await backend.init()
  const objects = new Objects(destination)
  const reopened = new MemoryStore(backend, objects)
  t.after(() => reopened.close())
  assert.equal(reopened.read(caller).facts[0].id, receipt.id)
  assert.deepEqual(await reopened.mutate(caller, args), receipt)
  await assert.rejects(upgradeSnapshot({ source, objects: join(root, 'objects'), destination }), {
    code: 'destination-exists'
  })
})

test('an incomplete or unknown snapshot cannot leave an activated upgrade', async (t) => {
  const { root } = await fixture(t)
  const source = join(root, 'bad-snapshot.json')
  await writeFile(source, JSON.stringify([['global', { schema: 99 }]]))
  const destination = join(root, 'rejected')
  await assert.rejects(upgradeSnapshot({ source, objects: join(root, 'objects'), destination }))
  await assert.rejects(access(destination), { code: 'ENOENT' })
})

test('terminal job maintenance frees capacity without replaying reviewed legacy ranges after reopen', async (t) => {
  const { root, caller, host, store } = await fixture(t)
  await evidence(store, host)
  await store.close()
  const source = join(root, 'state.json')
  const rows = JSON.parse(await readFile(source, 'utf8'))
  const state = rows[0][1]
  state.schema = 1
  delete state.factCandidates
  delete state.scheduled
  delete state.settled
  delete state.budget.unknown
  delete state.autonomy.configurationHash
  const job = state.jobs[0]
  delete job.reason
  state.jobs = Array.from({ length: 1000 }, (_, i) => ({
    ...job,
    id: 'completed-' + i,
    state: 'done'
  }))
  await writeFile(source, JSON.stringify(rows))
  const destination = join(root, 'upgraded')
  await upgradeSnapshot({ source, objects: join(root, 'objects'), destination })
  const backend = new FileBackend(destination)
  await backend.init()
  const next = new MemoryStore(backend, new Objects(destination))
  await next.maintainQueue(caller)
  assert.ok(next.stats(caller).jobTotal < 1000)
  await next.close()
  const reopened = new FileBackend(destination)
  await reopened.init()
  const latest = new MemoryStore(reopened, new Objects(destination))
  t.after(() => latest.close())
  assert.equal(
    (await latest.scheduleReview(host, { session: 'session-1', through: 3 })).scheduled,
    false
  )
  await latest.capture(host, {
    session: 'session-1',
    events: [{ seq: 4, kind: 'user-statement', text: 'A later task', successful: false }]
  })
  assert.equal(
    (await latest.scheduleReview(host, { session: 'session-1', through: 5 })).scheduled,
    true
  )
})

test('upgrade rejects duplicate scope keys before producing a target', async (t) => {
  const { root, store, caller } = await fixture(t)
  await store.mutate(caller, {
    op: 'add',
    content: 'Persist me',
    expectedRevision: 0,
    idempotencyKey: 'fact'
  })
  await store.close()
  const source = join(root, 'state.json'),
    rows = JSON.parse(await readFile(source, 'utf8'))
  const s = rows[0][1]
  s.schema = 1
  for (const key of ['factCandidates', 'scheduled', 'settled']) delete s[key]
  delete s.budget.unknown
  delete s.autonomy.configurationHash
  rows.push(rows[0])
  await writeFile(source, JSON.stringify(rows))
  const destination = join(root, 'duplicate-upgrade')
  await assert.rejects(upgradeSnapshot({ source, objects: join(root, 'objects'), destination }), {
    code: 'invalid-store'
  })
  await assert.rejects(access(destination), { code: 'ENOENT' })
})

test('old incomplete jobs remain quarantined even after their legacy deadline expires', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: 1800000000000 })
  const { root, store, host, caller } = await fixture(t)
  await evidence(store, host)
  await store.close()
  const source = join(root, 'state.json'),
    rows = JSON.parse(await readFile(source, 'utf8'))
  for (const [, s] of rows) {
    s.schema = 1
    for (const key of ['factCandidates', 'scheduled', 'settled']) delete s[key]
    delete s.budget.unknown
    delete s.autonomy.configurationHash
    for (const j of s.jobs) delete j.reason
  }
  await writeFile(source, JSON.stringify(rows))
  const destination = join(root, 'quarantined')
  await upgradeSnapshot({ source, objects: join(root, 'objects'), destination })
  const backend = new FileBackend(destination)
  await backend.init()
  const reopened = new MemoryStore(backend, new Objects(destination))
  t.after(() => reopened.close())
  const { LearningWorker } = await import('../lib/jobs.js')
  const worker = new LearningWorker(reopened, {
    route: () => {
      throw new Error('Legacy work must not resolve a route')
    }
  })
  t.after(() => worker.stop())
  t.mock.timers.tick(30 * 86400000)
  await worker.tick()
  assert.equal(reopened.stats(caller).jobCounts.paused, 1)
  assert.deepEqual(reopened.evidence(caller), rows[0][1].evidence)
})
