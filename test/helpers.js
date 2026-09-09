import { mkdtemp, rm, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MemoryStore } from '../lib/store.js'
import { Objects, FileBackend } from '../lib/files.js'
import { project } from '../lib/policy.js'
export const pkg = (
  content = 'Run the documented check and inspect its result.',
  name = 'learned-test-check'
) => ({
  name,
  description: 'Validate this project after changes',
  applicability: 'Only this project and its documented test command',
  content: '## Steps\n' + content + '\n\n## Verification\nCheck exit status and assertions.',
  resources: { 'references/check.md': 'Expected exit status: 0' }
})
export async function fixture(t) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'strique-memory-')))
  t.after(() => rm(root, { recursive: true, force: true }))
  const b = new FileBackend(root)
  await b.init()
  const objects = new Objects(root)
  await objects.init()
  const store = new MemoryStore(b, objects)
  t.after(() => store.close())
  const p = project(root),
    caller = {
      principal: 'owner',
      kind: 'operator',
      scope: p.key,
      root: p.root,
      session: 'session-1'
    }
  return {
    root,
    b,
    store,
    caller,
    host: { ...caller, kind: 'host' },
    agent: { ...caller, kind: 'agent' },
    objects
  }
}
export async function evidence(store, host) {
  await store.capture(host, {
    session: 'session-1',
    events: [
      {
        seq: 0,
        kind: 'user-statement',
        text: 'Run npm test before committing project changes.',
        successful: false
      },
      { seq: 2, kind: 'tool-result', text: 'npm test: 8 passing, exit 0', successful: true }
    ]
  })
  return store.evidence(host).map((e) => e.id)
}
export async function publish(store, caller, input) {
  const c = await store.propose(caller, input)
  await store.validate(caller, { id: c.id, hash: c.hash })
  return store.decide(caller, {
    id: c.id,
    hash: c.hash,
    base: c.base,
    approve: true,
    reason: 'Inspected exact content and source verification'
  })
}
