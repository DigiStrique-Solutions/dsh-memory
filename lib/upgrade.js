import { mkdtemp, lstat, rename, rm } from 'node:fs/promises'
import { dirname, basename, join, resolve } from 'node:path'
import { legacyStateSchema, stateSchema } from './schema.js'
import { readBounded, privateDirectory, atomicWrite, Objects } from './files.js'
import { digest, safe, fail } from './policy.js'

// Input is an operator-frozen snapshot. Never acquire or write the source store.
export async function upgradeSnapshot({ source, objects: objectRoot, destination }) {
  const target = resolve(destination)
  try {
    await lstat(target)
    fail('destination-exists', 'Choose a new destination for the upgraded snapshot')
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  const raw = await readBounded(source, 32 * 1024 * 1024)
  const input = JSON.parse(raw)
  const rows = Array.isArray(input) ? input : Object.entries(input.tables?.scopes ?? {})
  if (new Set(rows.map((row) => row[0])).size !== rows.length)
    fail('invalid-store', 'Duplicate scope keys')
  if (!rows.length) fail('invalid-store', 'Snapshot contains no scope records')
  const upgraded = rows.map(([key, value]) => {
    const old = safe(legacyStateSchema.parse(value))
    if (key !== old.scope) fail('invalid-store', 'Scope key mismatch')
    return [
      key,
      stateSchema.parse({
        ...old,
        schema: 2,
        budget: {
          day: old.budget.day,
          reserved: old.budget.reserved,
          used: 0,
          unknown: old.jobs.reduce((n, j) => n + j.attempts, 0)
        },
        autonomy: { enabled: false, evaluation: null, classes: [] },
        scheduled: { ...old.cursors },
        jobs: old.jobs.map((j) =>
          ['pending', 'running'].includes(j.state)
            ? {
                ...j,
                state: 'paused',
                error: 'legacy-context-review-required',
                reason: 'legacy-incomplete'
              }
            : j
        )
      })
    ]
  })
  await privateDirectory(dirname(target))
  const stage = await mkdtemp(join(dirname(target), '.' + basename(target) + '-upgrade-'))
  try {
    const objects = new Objects(stage)
    await objects.init()
    for (const [, state] of upgraded) {
      for (const hash of new Set(
        state.publications.flatMap((p) => [p.active, ...p.history]).filter(Boolean)
      )) {
        const content = await readBounded(join(objectRoot, hash + '.json'), 256 * 1024)
        if (digest(content) !== hash) fail('object-corrupt', 'Snapshot object hash mismatch')
        if ((await objects.put(JSON.parse(content))) !== hash)
          fail('object-corrupt', 'Noncanonical object')
      }
    }
    await atomicWrite(join(stage, 'state.json'), JSON.stringify(upgraded))
    const report = {
      version: 2,
      sourceHash: digest(raw),
      stateHash: digest(JSON.stringify(upgraded)),
      scopes: upgraded.length,
      completed: true
    }
    await atomicWrite(join(stage, 'upgrade.json'), JSON.stringify(report))
    await rename(stage, target)
    return report
  } finally {
    await rm(stage, { recursive: true, force: true })
  }
}

// The Host calls this under its owner lock before exposing the service. A completion
// marker distinguishes a deliberate first import from ordinary subsequent edits.
export async function bootstrapUpgrade(root, table) {
  let manifest
  try {
    manifest = JSON.parse(await readBounded(join(root, 'upgrade.json'), 4096))
  } catch (e) {
    if (e.code === 'ENOENT') return
    throw e
  }
  try {
    const completed = JSON.parse(await readBounded(join(root, 'host-import.json'), 4096))
    if (completed.stateHash !== manifest.stateHash)
      fail('invalid-store', 'Upgrade identity changed')
    return
  } catch (e) {
    if (e.code !== 'ENOENT') throw e
  }
  const raw = await readBounded(join(root, 'state.json'), 32 * 1024 * 1024)
  if (manifest.version !== 2 || manifest.completed !== true || digest(raw) !== manifest.stateHash)
    fail('invalid-store', 'Upgrade is incomplete or changed')
  const rows = JSON.parse(raw),
    objects = new Objects(root)
  if (
    !Array.isArray(rows) ||
    rows.length !== manifest.scopes ||
    new Set(rows.map((r) => r[0])).size !== rows.length
  )
    fail('invalid-store', 'Upgrade scope manifest mismatch')
  for (const [key, value] of rows) {
    const s = safe(stateSchema.parse(value))
    if (key !== s.scope || !/^(project-[a-f0-9]{24}|global)$/.test(key))
      fail('invalid-store', 'Invalid upgrade scope')
    for (const hash of new Set(
      s.publications.flatMap((p) => [p.active, ...p.history]).filter(Boolean)
    ))
      await objects.get(hash)
    const existing = table.get(key)
    if (existing && digest(existing) !== digest(value))
      fail('revision-conflict', 'Host data differs from the unfinished import')
  }
  for (const [key, value] of rows) if (!table.get(key)) await table.put(key, value)
  await atomicWrite(
    join(root, 'host-import.json'),
    JSON.stringify({ stateHash: manifest.stateHash })
  )
}
