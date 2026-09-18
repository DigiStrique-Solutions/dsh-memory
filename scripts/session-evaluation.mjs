import { Context } from '@deepseek-ai/cordis'
import Settings from '@deepseek-ai/dsh-settings'
import Storage from '@deepseek-ai/dsh-storage'
import * as JsonStorage from '@deepseek-ai/dsh-storage-json'
import * as Domains from '@deepseek-ai/dsh-storage-domain'
import Skills from '@deepseek-ai/dsh-skill'
import Sessions from '@deepseek-ai/dsh-session'
import Agents, { agentEvents } from '@deepseek-ai/dsh-agent'
import Tools from '@deepseek-ai/dsh-tools'
import * as SkillTool from '@deepseek-ai/dsh-tool-skill'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { mkdtemp, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Memory, { Config } from '../lib/index.js'
import * as MemoryTools from '../lib/tools.js'
import * as Learning from '../lib/learning.js'
import { digest, safe } from '../lib/policy.js'
class EvaluationSettings extends Settings {
  writable = true
  async load() {
    return {}
  }
  async persist() {}
}
// Calls are sequential: each case owns a separate home and fresh real Cordis graph.
// Only external model/reviewer boundaries are supplied by the driver.
export async function evaluateSessionCase({ driver, entry, mode, config = {}, repetition = 0 }) {
  if (
    !['none', 'memory', 'learning'].includes(mode) ||
    !Array.isArray(entry.training) ||
    entry.training.length > 256 ||
    typeof entry.heldOut?.input !== 'string' ||
    !Object.hasOwn(entry.heldOut, 'expected')
  )
    throw new Error('Invalid session-learning case')
  const root = await realpath(await mkdtemp(join(tmpdir(), 'memory-session-eval-')))
  const previous = process.env.DSH_HOME,
    ctx = new Context(),
    signal = AbortSignal.timeout(120000)
  process.env.DSH_HOME = root
  const start = performance.now()
  try {
    await ctx.plugin(EvaluationSettings)
    await ctx.plugin(Storage)
    await ctx.plugin(JsonStorage, { root: join(root, 'domains') })
    await ctx.plugin(Domains, { backend: 'json' })
    await ctx.plugin(Skills)
    await ctx.plugin(Sessions)
    await ctx.plugin(Agents)
    await ctx.plugin(Tools)
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(Memory, Config({ remoteEgress: true }))
    await ctx.plugin(MemoryTools)
    await ctx.plugin(SkillTool)
    ctx.provide('llm', { stream: (request) => driver.stream(request) })
    const learning = Learning.Config({
      ...config,
      enabled: true,
      provider: config.provider ?? 'evaluation',
      model: driver.model
    })
    await ctx.plugin(Learning, learning)
    const store = ctx.striqueMemory.store
    const train = ctx.sessions.create('training', { meta: { cwd: root } })
    const caller = { ...ctx.striqueMemory.fromAgent({ session: train }), kind: 'operator' }
    const configuration = store.evaluationConfiguration()
    if (mode !== 'none') {
      train.append('turn/start', { turn: 1 })
      for (const event of entry.training) {
        if (!['user/message', 'assistant/message', 'tool/call', 'tool/result'].includes(event.type))
          throw new Error('Training accepts conversation events only')
        train.append(event.type, safe(event.data), { surfaceOp: 'append' })
        await ctx.sessions.flush(train)
      }
      train.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
      await ctx.sessions.flush(train)
      while (true) {
        signal.throwIfAborted()
        const status = store.stats(caller)
        if (status.jobTotal && status.jobCounts.pending === 0 && status.jobCounts.running === 0) {
          if (status.jobCounts.failed || status.jobCounts.paused)
            throw new Error('Training review did not complete')
          break
        }
        await new Promise((resolve) => setTimeout(resolve, 20))
      }
      if (mode === 'learning')
        for (const candidate of store.review(caller).candidates) {
          // Review sees training-derived candidates only, never the held-out task or oracle.
          if (
            typeof driver.review !== 'function' ||
            (await driver.review(safe(candidate))) !== true
          )
            continue
          await store.validate(caller, candidate)
          await store.decide(caller, {
            ...candidate,
            approve: true,
            reason: 'Isolated benchmark review'
          })
        }
    }
    const budget = store.stats(caller).budget
    // Freeze every write boundary before the held-out task is disclosed.
    store.policy = {
      ...store.policy,
      capture: false,
      mutate: false,
      publish: false,
      remoteEgress: false,
      read: mode !== 'none'
    }
    const revision = store.stats({ ...caller }).revision
    const fresh = ctx.sessions.create('held-out', { meta: { cwd: root } })
    const agent = { id: fresh.id, ctx, session: fresh }
    fresh.append('turn/start', { turn: 1 })
    const direct = createUserMessage({
      source: { kind: 'user' },
      content: [{ type: 'text', text: entry.heldOut.input }]
    })
    const decision =
      mode === 'learning'
        ? await agentEvents(ctx, agent).waterfall(
            'agent/pre-step',
            { messages: [direct], turn: 1, step: 1, signal },
            () => Promise.resolve({ kind: 'enter', messages: [direct] })
          )
        : { messages: [direct] }
    for (const message of decision.messages)
      fresh.append('user/message', message, { surfaceOp: 'append' })
    let skillLoads = 0,
      calls = 0
    const allowed =
      mode === 'none'
        ? []
        : [
            'memory_read',
            'memory_search',
            ...(mode === 'learning' ? ['skill', 'learning_resource'] : [])
          ]
    const heldOutStart = performance.now()
    const result = await driver.run(
      safe({
        task: entry.heldOut.input,
        messages: decision.messages,
        system: mode === 'none' ? '' : await ctx.systemPrompt.assemble({ scope: agent }),
        tools: ctx.tools.schemas(agent).filter((t) => allowed.includes(t.name))
      }),
      {
        signal,
        maxTokens: 2048,
        execute: async (name, args) => {
          if (!allowed.includes(name) || ++calls > 20)
            throw new Error('Held-out tool is unavailable or call limit reached')
          const result = await ctx.tools.execute({
            name,
            arguments: args,
            agent,
            signal,
            callId: 'eval-' + calls
          })
          if (name === 'skill' && !result.isError && result.value?.provider === 'strique-learned')
            skillLoads++
          return safe(result)
        }
      }
    )
    const trainingFrozen = store.stats(caller).revision === revision
    if (!trainingFrozen) throw new Error('Held-out task changed training memory')
    return {
      id: entry.id + ':' + repetition,
      repetition,
      mode,
      heldOut: true,
      oracle: 'withheld-exact',
      success: digest(result.answer) === digest(entry.heldOut.expected),
      tokens: result.usage?.totalTokens ?? null,
      extractionTokens: budget.unknown ? null : budget.used,
      skillLoads,
      trainingFrozen,
      sessionProtocol: 'harness',
      latencyMs: Math.round(performance.now() - heldOutStart),
      totalLatencyMs: Math.round(performance.now() - start),
      configuration
    }
  } finally {
    await ctx.fiber.dispose()
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
    await rm(root, { recursive: true, force: true })
  }
}
