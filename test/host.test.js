import Settings from '@deepseek-ai/dsh-settings'
import test from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import Storage from '@deepseek-ai/dsh-storage'
import * as JsonStorage from '@deepseek-ai/dsh-storage-json'
import * as Domains from '@deepseek-ai/dsh-storage-domain'
import Skills from '@deepseek-ai/dsh-skill'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import Tools from '@deepseek-ai/dsh-tools'
import Agents from '@deepseek-ai/dsh-agent'
import { createScope } from '@deepseek-ai/dsh-scope'
import * as SkillTool from '@deepseek-ai/dsh-tool-skill'
import Memory, { Config } from '../lib/index.js'
import * as ToolPlugin from '../lib/tools.js'
import * as Learning from '../lib/learning.js'
import { fixture, evidence, pkg, publish } from './helpers.js'
import { join } from 'node:path'

class TestSettings extends Settings {
  writable = true
  async load() {
    return {}
  }
  async persist() {}
}

test('real Cordis services register tools, recall and learned provider; unload and reopen retain facts', async (t) => {
  const { root } = await fixture(t),
    previous = process.env.DSH_HOME
  process.env.DSH_HOME = root
  t.after(() => {
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
  })
  const ctx = new Context()
  await ctx.plugin(TestSettings)
  t.after(() => ctx.fiber.dispose())
  await ctx.plugin(Storage)
  await ctx.plugin(JsonStorage, { root: join(root, 'domains') })
  await ctx.plugin(Domains, { backend: 'json' })
  await ctx.plugin(Skills)
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(Tools)
  await ctx.plugin(Agents)
  await ctx.plugin(SkillTool)
  const fiber = ctx.plugin(Memory, Config({}))
  await fiber
  assert.ok(ctx.striqueMemory?.ready)
  const toolFiber = ctx.plugin(ToolPlugin)
  await toolFiber
  const learnFiber = ctx.plugin(Learning, Learning.Config({ enabled: false }))
  await learnFiber
  const agent = { session: { id: 'a', header: { cwd: root } } },
    signal = new AbortController().signal
  const result = await ctx.tools.execute({
    name: 'memory_mutate',
    callId: 'call-a',
    arguments: {
      op: 'add',
      content: 'Durable Host fact',
      expectedRevision: 0,
      idempotencyKey: 'host'
    },
    agent,
    signal
  })
  assert.equal(result.isError, false, JSON.stringify(result))
  const assembled = await ctx.systemPrompt.assemble({ scope: agent })
  assert.ok(JSON.stringify(assembled).includes('Durable Host fact'))
  const caller = { ...ctx.striqueMemory.fromAgent(agent, signal), kind: 'operator' },
    host = { ...caller, kind: 'host' },
    refs = await evidence(ctx.striqueMemory.store, host)
  const active = await publish(ctx.striqueMemory.store, caller, { package: pkg(), evidence: refs })
  const catalog = await ctx.skills.list({ cwd: root })
  assert.ok(catalog.some((s) => s.name === pkg().name))
  const loaded = await ctx.skills.get(pkg().name, { cwd: root })
  assert.ok(!loaded.content.includes('Expected exit status: 0'))
  const resource = await ctx.tools.execute({
    name: 'learning_resource',
    callId: 'resource-a',
    agent,
    signal,
    arguments: { name: pkg().name, hash: active.publication.active, path: 'references/check.md' }
  })
  assert.equal(resource.isError, false, JSON.stringify(resource))
  assert.equal(resource.value.content, 'Expected exit status: 0')
  let scope
  await ctx.plugin(
    Object.assign(
      (inner) => {
        scope = createScope(inner, agent)
      },
      { inject: ['tools'] }
    )
  )
  const unrestrict = scope.ctx.tools.restrict({ deny: ['skill'] })
  const denied = await ctx.tools.execute({
    name: 'learning_resource',
    callId: 'denied',
    agent,
    signal,
    arguments: { name: pkg().name, hash: active.publication.active, path: 'references/check.md' }
  })
  assert.equal(denied.isError, true)
  unrestrict()
  assert.equal(ctx.striqueMemory.store.state(caller).outcomes.length, 0)
  const shadow = ctx.skills.register({
    name: pkg().name,
    description: 'Protected local skill',
    source: 'runtime',
    content: 'Local instructions'
  })
  const shadowed = await ctx.tools.execute({
    name: 'learning_resource',
    callId: 'shadowed',
    agent,
    signal,
    arguments: { name: pkg().name, hash: active.publication.active, path: 'references/check.md' }
  })
  assert.equal(shadowed.isError, true)
  shadow()
  const skill = await ctx.tools.execute({
    name: 'skill',
    callId: 'load-skill',
    agent,
    signal,
    arguments: { name: pkg().name }
  })
  assert.equal(skill.isError, false)
  await ctx.striqueMemory.store.tail
  const exposures = ctx.striqueMemory.store.state(caller).outcomes
  assert.equal(exposures.length, 1)
  assert.equal(exposures[0].session, 'a')
  assert.equal(exposures[0].kind, 'exposure')

  assert.equal((await ctx.skills.list({ cwd: '/' })).length, 0)
  await learnFiber.dispose()
  assert.equal((await ctx.skills.list({ cwd: root })).length, 0)
  await toolFiber.dispose()
  await fiber.dispose()
  assert.equal(ctx.get('striqueMemory'), undefined)
  const again = ctx.plugin(Memory, Config({}))
  await again
  assert.equal(ctx.striqueMemory.store.read(ctx.striqueMemory.fromAgent(agent, signal)).total, 1)
  await again.dispose()
})

test('required storage dependency arrival and withdrawal reload the consumer once', async (t) => {
  const { root } = await fixture(t),
    previous = process.env.DSH_HOME
  process.env.DSH_HOME = root
  t.after(() => {
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
  })
  const ctx = new Context()
  await ctx.plugin(TestSettings)
  t.after(() => ctx.fiber.dispose())
  const memory = ctx.plugin(Memory, Config({}))
  assert.equal(memory.state, 0)
  await ctx.plugin(Storage)
  await ctx.plugin(JsonStorage, { root: join(root, 'domains') })
  const domain = ctx.plugin(Domains, { backend: 'json' })
  await domain
  await memory
  assert.equal(memory.state, 2)
  assert.ok(ctx.striqueMemory.ready)
  await domain.dispose()
  assert.equal(memory.state, 0)
  assert.equal(ctx.get('striqueMemory'), undefined)
  const restored = ctx.plugin(Domains, { backend: 'json' })
  await restored
  await memory
  assert.equal(memory.state, 2)
  await memory.dispose()
  await restored.dispose()
})

test('real session flush captures immediately but extraction waits for the completed turn', async (t) => {
  const { default: Sessions } = await import('@deepseek-ai/dsh-session')
  const { createUserMessage } = await import('@deepseek-ai/dsh-llm')
  const { root } = await fixture(t),
    previous = process.env.DSH_HOME
  process.env.DSH_HOME = root
  t.after(() => {
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
  })
  const ctx = new Context()
  await ctx.plugin(TestSettings)
  t.after(() => ctx.fiber.dispose())
  await ctx.plugin(Storage)
  await ctx.plugin(JsonStorage, { root: join(root, 'domains') })
  await ctx.plugin(Domains, { backend: 'json' })
  await ctx.plugin(Skills)
  await ctx.plugin(Sessions)
  await ctx.plugin(Memory, Config({ remoteEgress: true }))
  let calls = 0
  ctx.provide('llm', {
    async *stream(request) {
      calls++
      const input = JSON.parse(request.messages[0].content[0].text),
        text = JSON.stringify({
          candidates: [
            {
              package: pkg('Use the verified runtime check', 'learned-runtime-roundtrip'),
              evidence: input.evidence.map((e) => e.id),
              base: null
            }
          ]
        })
      yield { type: 'block-start', index: 0, blockType: 'text' }
      yield { type: 'text-delta', index: 0, text }
      yield { type: 'block-end', index: 0, block: { type: 'text', text } }
      yield { type: 'finish', reason: { kind: 'stop' } }
    }
  })
  const learning = ctx.plugin(Learning, Learning.Config({ provider: 'test', model: 'test' }))
  await learning
  const session = ctx.sessions.create('runtime-session', { meta: { cwd: root } })
  session.append('turn/start', { turn: 1 })
  session.append(
    'user/message',
    createUserMessage({
      content: [
        {
          type: 'text',
          text: 'Always run the documented runtime check before changing this project.'
        }
      ],
      source: { kind: 'user' }
    }),
    { surfaceOp: 'append' }
  )
  await ctx.sessions.flush(session)
  const caller = { ...ctx.striqueMemory.fromAgent({ session }), kind: 'operator' }
  assert.equal(ctx.striqueMemory.store.stats(caller).jobs.length, 0)
  session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
  await ctx.sessions.flush(session)
  for (let i = 0; i < 100 && !ctx.striqueMemory.store.review(caller).total; i++)
    await new Promise((r) => setTimeout(r, 20))
  assert.equal(ctx.striqueMemory.store.review(caller).total, 1)
  assert.equal(ctx.striqueMemory.store.review(caller).candidates[0].trust, 'user-supported')
  assert.equal(ctx.striqueMemory.store.catalog(caller).length, 0)
  assert.equal(calls, 1)
  await learning.dispose()
})

test('distinct homes sharing a configured backend cannot share the canonical unit', async (t) => {
  const { root } = await fixture(t),
    previous = process.env.DSH_HOME
  t.after(() => {
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
  })
  const contexts = []
  for (const home of ['a', 'b']) {
    process.env.DSH_HOME = join(root, home)
    const ctx = new Context()
    await ctx.plugin(TestSettings)
    contexts.push(ctx)
    t.after(() => ctx.fiber.dispose())
    await ctx.plugin(Storage)
    await ctx.plugin(JsonStorage, { root: join(root, 'shared-backend') })
    await ctx.plugin(Domains, { backend: 'json' })
    await ctx.plugin(Memory, Config({}))
  }
  const caller = contexts[0].striqueMemory.fromCwd(root)
  await contexts[0].striqueMemory.store.mutate(caller, {
    op: 'add',
    content: 'Only home A',
    expectedRevision: 0,
    idempotencyKey: 'a'
  })
  assert.equal(
    contexts[1].striqueMemory.store.read(contexts[1].striqueMemory.fromCwd(root)).total,
    0
  )
})

test('invalid saved policy fails service initialization and releases ownership', async (t) => {
  const { root } = await fixture(t),
    previous = process.env.DSH_HOME
  process.env.DSH_HOME = root
  t.after(() => {
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
  })
  class InvalidSettings extends TestSettings {
    async load() {
      return { 'strique-memory': { read: 'invalid' } }
    }
  }
  const ctx = new Context()
  t.after(() => ctx.fiber.dispose())
  await ctx.plugin(InvalidSettings)
  await ctx.plugin(Storage)
  await ctx.plugin(JsonStorage, { root: join(root, 'domains') })
  await ctx.plugin(Domains, { backend: 'json' })
  const fiber = ctx.plugin(Memory, Config({}))
  await assert.rejects(async () => await fiber)
  assert.notEqual(fiber.state, 2)
  const { access } = await import('node:fs/promises')
  await assert.rejects(access(join(root, 'strique-memory-v2', '.owner.lock')), { code: 'ENOENT' })
})

test('Host imports a completed v2 upgrade once and preserves subsequent changes across reload', async (t) => {
  const { upgradeSnapshot } = await import('../lib/upgrade.js')
  const { readFile, writeFile } = await import('node:fs/promises')
  const { root, store, caller } = await fixture(t)
  const fact = await store.mutate(caller, {
    op: 'add',
    content: 'Before upgrade',
    expectedRevision: 0,
    idempotencyKey: 'old'
  })
  await store.close()
  const source = join(root, 'state.json'),
    rows = JSON.parse(await readFile(source, 'utf8'))
  for (const [, s] of rows) {
    s.schema = 1
    for (const k of ['scheduled', 'settled', 'factCandidates']) delete s[k]
    delete s.budget.unknown
    delete s.autonomy.configurationHash
  }
  await writeFile(source, JSON.stringify(rows))
  await upgradeSnapshot({
    source,
    objects: join(root, 'objects'),
    destination: join(root, 'strique-memory-v2')
  })
  const previous = process.env.DSH_HOME
  process.env.DSH_HOME = root
  t.after(() => {
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
  })
  const ctx = new Context()
  t.after(() => ctx.fiber.dispose())
  await ctx.plugin(TestSettings)
  await ctx.plugin(Storage)
  await ctx.plugin(JsonStorage, { root: join(root, 'domains') })
  await ctx.plugin(Domains, { backend: 'json' })
  const first = ctx.plugin(Memory, Config({}))
  await first
  assert.equal(ctx.striqueMemory.store.read(caller).facts[0].id, fact.id)
  await ctx.striqueMemory.store.mutate(caller, {
    op: 'update',
    id: fact.id,
    content: 'After upgrade',
    expectedRevision: fact.revision,
    idempotencyKey: 'new'
  })
  await first.dispose()
  await ctx.plugin(Memory, Config({}))
  assert.equal(ctx.striqueMemory.store.read(caller).facts[0].content, 'After upgrade')
})

test('disabling extraction keeps completed-turn capture available', async (t) => {
  const { default: Sessions } = await import('@deepseek-ai/dsh-session')
  const { createUserMessage } = await import('@deepseek-ai/dsh-llm')
  const { root } = await fixture(t),
    previous = process.env.DSH_HOME
  process.env.DSH_HOME = root
  t.after(() => {
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
  })
  const ctx = new Context()
  t.after(() => ctx.fiber.dispose())
  await ctx.plugin(TestSettings)
  await ctx.plugin(Storage)
  await ctx.plugin(JsonStorage, { root: join(root, 'domains') })
  await ctx.plugin(Domains, { backend: 'json' })
  await ctx.plugin(Skills)
  await ctx.plugin(Sessions)
  await ctx.plugin(Memory, Config({}))
  await ctx.plugin(Learning, Learning.Config({ enabled: false }))
  const session = ctx.sessions.create('capture-only', { meta: { cwd: root } })
  session.append('turn/start', { turn: 1 })
  session.append(
    'user/message',
    createUserMessage({
      source: { kind: 'user' },
      content: [{ type: 'text', text: 'Retain this task for later review' }]
    }),
    { surfaceOp: 'append' }
  )
  session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
  await ctx.sessions.flush(session)
  const caller = ctx.striqueMemory.fromAgent({ session })
  assert.equal(ctx.striqueMemory.store.stats(caller).jobTotal, 1)
  assert.equal(ctx.striqueMemory.store.stats(caller).extraction.enabled, false)
})
