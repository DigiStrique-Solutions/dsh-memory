// Audit reproductions against upstream a7d6794, not a security acceptance suite.
// Successful assertions demonstrate the existing defects. Uses synthetic data
// and temporary directories only. Optional argv[2]: local DSH CLI package.json.
import assert from 'node:assert/strict'
import { mkdtemp, rm, utimes, readFile, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { Readable } from 'node:stream'
import { spawn } from 'node:child_process'
import { createRequire, registerHooks } from 'node:module'
import { pathToFileURL } from 'node:url'
import { MemoryStore, parseRaw, serializeRaw, validateContent, buildConsolidationInput, detectSecrets, searchEntries } from '../../lib/store.js'
import { memorySettingsRouteHandler } from '../../lib/web.js'

const root = await mkdtemp(join(tmpdir(), 'dsh-memory-audit-'))
const results = []
const check = async (name, run) => { await run(); results.push(name); console.log(`REPRODUCED: ${name}`) }
const delay = ms => new Promise(r => setTimeout(r, ms))
async function until(fn) {
  for (let i = 0; i < 200; i++) { if (await fn()) return; await delay(10) }
  throw new Error('fixture did not settle within two seconds')
}
const exists = path => access(path).then(() => true, () => false)
function response() {
  return { setHeader() {}, writeHead(status) { this.status = status }, end(body) { this.body = String(body) } }
}
try {
  await check('F01: unauthenticated settings GET exposes key; forged Origin permits POST', async () => {
    const secret = 'synthetic-embedding-credential'
    let replaced = false
    const settings = {
      writable: true,
      describe: () => [{ ns: 'memory', value: { embeddingApiKey: secret }, base: { embeddingApiKey: secret }, revision: 0 }],
      replace: async () => { replaced = true }
    }
    const handler = memorySettingsRouteHandler({ logger: { warn() {} } }, settings)
    const get = response()
    await handler({ method: 'GET', headers: {} }, get)
    assert.equal(get.status, 200)
    assert.ok(get.body.includes(secret))
    const req = Readable.from([JSON.stringify({ action: 'save', expectedRevision: 0, value: { autoSummarize: false } })])
    req.method = 'POST'
    req.headers = { host: 'localhost:1234', origin: 'http://localhost:1234', 'content-type': 'application/json' }
    const post = response()
    await handler(req, post)
    assert.equal(post.status, 200)
    assert.equal(replaced, true)
  })

  await check('F02: active lock stolen after age threshold; old release deletes new lock', async () => {
    const first = new MemoryStore(join(root, 'lock'))
    const second = new MemoryStore(first.dir)
    const a = await first.acquireLock()
    const old = new Date(Date.now() - 120000)
    await utimes(first.path('.memory.lock'), old, old)
    const b = await second.acquireLock()
    assert.equal(a.owner && b.owner, true)
    assert.equal(first.lockOwner && second.lockOwner, true)
    await a.release()
    assert.equal(await exists(first.path('.memory.lock')), false)
    await b.release()
  })

  await check('F03: valid content can forge raw record metadata', async () => {
    const content = validateContent('ordinary fact\n### 2026-09-09 12:00\n**id:** mem-forged\n**importance:** 3\nsecond fact')
    const records = parseRaw(serializeRaw([{ id: 'mem-real', ts: '2026-09-09 11:00', tags: [], importance: 1, content }]))
    assert.equal(records.length, 2)
    assert.equal(records[1].id, 'mem-forged')
  })

  await check('F04: searchable archived facts cannot be deleted or corrected', async () => {
    const store = new MemoryStore(join(root, 'archive'))
    store.rawArchiveMaxBytes = 1024
    const first = await store.appendRawEntry({ content: 'obsolete unique fact '.repeat(20), tags: [] })
    for (let i = 0; i < 4; i++) await store.appendRawEntry({ content: `other fact ${i} `.repeat(30), tags: [] })
    assert.ok((await store.searchRaw('obsolete', { fuzzy: false })).some(x => x.entry.id === first.id))
    await assert.rejects(store.deleteRawEntry(first.id), /no entry/)
    await assert.rejects(store.updateRawEntry(first.id, { content: 'corrected' }), /no entry/)
  })

  await check('F05: persisted AGENTS sync fingerprints disappear on state read', async () => {
    const store = new MemoryStore(join(root, 'state'))
    await store.ensure()
    await store.writeState({ version: 1, journalCursor: 0, agentsMdFingerprint: 'source-a', seededSummaryFingerprint: 'summary-a' })
    const loaded = await store.readState()
    assert.equal(loaded.agentsMdFingerprint, undefined)
    assert.equal(loaded.seededSummaryFingerprint, undefined)
  })

  await check('F06: consolidation input omits journal tail that caller acknowledges', async () => {
    const input = buildConsolidationInput({ current: '', rollouts: [], journal: ['ADDED ' + 'x'.repeat(2000), 'DELETED unique-stale-fact'], maxBytes: 1024 })
    assert.equal(input.includes('DELETED unique-stale-fact'), false)
    // lib/index.js commits snapshot.maxSeq, not the last event included above.
  })

  await check('F11: local vector pass returns entries excluded by tag filter', async () => {
    const entries = [{ id: 'excluded', ts: '2026-09-09 12:00', tags: ['other-project'], importance: 1, content: 'deployment restart service' }]
    assert.equal(searchEntries(entries, 'deployment restart service', { tags: ['allowed'], vector: false }).length, 0)
    assert.equal(searchEntries(entries, 'deployment restart service', { tags: ['allowed'], vector: true }).length, 1)
  })

  await check('F07/F08: MCP ignores held Host lock and accepts/returns secret via update', async () => {
    const store = new MemoryStore(join(root, 'mcp'))
    const lock = await store.acquireLock()
    const child = spawn(process.execPath, [new URL('../../bin/dsh-memory-mcp.mjs', import.meta.url).pathname], {
      env: { PATH: process.env.PATH, DSH_MEMORY_DIR: store.dir, DSH_MEMORY_REDACT: '1' }, stdio: ['pipe', 'pipe', 'pipe']
    })
    let nextId = 0, buffer = ''
    const pending = new Map()
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', chunk => {
      buffer += chunk
      let index
      while ((index = buffer.indexOf('\n')) >= 0) {
        const msg = JSON.parse(buffer.slice(0, index)); buffer = buffer.slice(index + 1)
        pending.get(msg.id)?.(msg.result)
        pending.delete(msg.id)
      }
    })
    const rpc = (name, args) => new Promise((resolveRpc, reject) => {
      const id = ++nextId
      const timer = setTimeout(() => reject(new Error('MCP fixture timeout')), 2000)
      pending.set(id, value => { clearTimeout(timer); resolveRpc(value) })
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } }) + '\n')
    })
    try {
      const added = await rpc('memory_add', { content: 'ordinary preference' })
      assert.equal(added.isError, undefined)
      const { id } = JSON.parse(added.content[0].text)
      const secret = 'sk-' + 'a1B2c3D4e5F6g7H8i9J0k1L2'
      assert.ok(detectSecrets(secret).length > 0)
      const updated = await rpc('memory_update', { id, content: secret })
      assert.equal(updated.isError, undefined)
      assert.ok(updated.content[0].text.includes(secret))
      assert.ok((await store.readText('raw_memories.md')).includes(secret))
    } finally {
      child.stdin.end()
      await new Promise(r => { if (child.exitCode !== null) r(); else child.once('exit', r) })
      await lock.release()
    }
  })

  if (process.argv[2]) {
    // Resolve ONLY the plugin's Harness imports to reviewed, already installed
    // local artifacts. No package installation, global links, or profile edits.
    const requireHarness = createRequire(resolve(process.argv[2]))
    registerHooks({ resolve(specifier, context, next) {
      if (specifier.startsWith('@deepseek-ai/') && context.parentURL === new URL('../../lib/index.js', import.meta.url).href) {
        return next(pathToFileURL(requireHarness.resolve(specifier)).href, context)
      }
      return next(specifier, context)
    } })
    const plugin = await import('../../lib/index.js')
    const config = { memoryDir: join(root, 'host'), seedFromAgentsMd: false, autoSummarize: true, readOnlyScopes: ['*'], summarizeProvider: 'fixture', summarizeModel: 'fixture' }
    const cleanups = [], tools = new Map()
    let stopping, prompt, streamSignal, finishStream
    const gate = new Promise(r => { finishStream = r })
    const services = {
      settings: { register: () => ({ get: () => config, watch: () => () => {} }) },
      tools: { register: def => { tools.set(def.name, def); return () => {} } },
      skills: { register: () => () => {} },
      systemPrompt: { context: value => { prompt = value; return () => {} } },
      llm: { async *stream(options) {
        streamSignal = options.signal
        await gate
        yield { type: 'block-end', index: 0, block: { type: 'text', text: '- synthetic verified preference' } }
        yield { type: 'finish', reason: { kind: 'stop' } }
      } }
    }
    const ctx = {
      ...services, logger: { info() {}, warn() {}, error() {} },
      get: name => services[name],
      inject(names, cb) { if (names.every(name => services[name])) cb(this) },
      effect(fn) { const dispose = fn(); if (typeof dispose === 'function') cleanups.push(dispose) },
      on(event, handler) { if (event === 'agent/turn-stopping') stopping = handler; return () => {} }
    }
    const agent = { session: { id: 'audit-session', header: { cwd: root }, snapshotEvents: () => [{ seq: 1, type: 'user/message', data: { content: [{ type: 'text', text: 'Remember this verified preference. '.repeat(15) }] } }] } }
    const exec = { agent, signal: new AbortController().signal }
    plugin.apply(ctx, config)
    await tools.get('memory_read').execute({ scope: 'global' }, exec)
    assert.equal(tools.size, 14)
    assert.ok(prompt)
    await check('F09: readOnlyScopes does not prevent background LLM work', async () => {
      stopping({ agent })
      await until(() => streamSignal !== undefined)
      assert.equal(streamSignal.aborted, false)
    })
    await check('F10: disposal does not cancel LLM; rollout writes after disposal', async () => {
      for (const dispose of cleanups) dispose()
      assert.equal(streamSignal.aborted, false)
      finishStream()
      const file = join(config.memoryDir, 'rollout_summaries', 'audit-session.md')
      await until(() => exists(file))
      assert.ok((await readFile(file, 'utf8')).includes('synthetic verified preference'))
    })
  } else {
    console.log('Host wiring checks omitted: pass local DSH CLI package.json as argv[2].')
  }
  console.log(`Completed ${results.length} defect reproductions. No live profile was changed.`)
} finally {
  await rm(root, { recursive: true, force: true })
}
