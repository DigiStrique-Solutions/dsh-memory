import { Service } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { MemoryStore } from './store.js'
import { stateSchema } from './schema.js'
import { acquireOwner, Objects } from './files.js'
import { project, DEFAULT_POLICY, fail, operator, digest } from './policy.js'

export const name = 'strique-memory'
export const Config = Schema.object({
  read: Schema.boolean().default(true),
  capture: Schema.boolean().default(true),
  mutate: Schema.boolean().default(true),
  publish: Schema.boolean().default(true),
  export: Schema.boolean().default(true),
  remoteEgress: Schema.boolean().default(false),
  recallBytes: Schema.number().step(1).min(512).max(32768).default(8192)
})
const domainSpecFor = (root) =>
  defineDomain({
    name: 'strique_memory_' + digest(root).slice(0, 24),
    version: 1,
    tables: { scopes: domainTable(stateSchema) }
  })
export default class StriqueMemory extends Service {
  static inject = ['storageDomain', 'settings']
  static Config = Config
  constructor(ctx, config) {
    super(ctx, 'striqueMemory')
    if (Object.keys(config).some((key) => !Object.hasOwn(Config({}), key)))
      fail('invalid-config', 'Unknown memory configuration field')
    this.config = Object.fromEntries(
      Object.keys(Config({})).map((key) => [key, config[key] ?? Config({})[key]])
    )
    this.controller = new AbortController()
    this.jobs = new Set()
    this.ready = false
    this.root = join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'strique-memory-v1')
    ctx.effect(() => () => this.dispose())
  }
  async [Service.init]() {
    this.release = await acquireOwner(this.root)
    try {
      this.domain = await this.ctx.storageDomain.open(domainSpecFor(this.root))
      const table = this.domain.table('scopes')
      const backend = {
        get: (key) => table.get(key),
        entries: () => [...table.entries()],
        put: (key, value) => table.put(key, value),
        close: () => this.domain.close()
      }
      const objects = new Objects(this.root)
      await objects.init()
      this.store = new MemoryStore(backend, objects, {
        policy: Object.fromEntries(
          Object.keys(DEFAULT_POLICY).map((key) => [key, this.config[key]])
        )
      })
      this.ready = true
      {
        const settingsCtx = this.ctx
        const section = settingsCtx.settings.register('strique-memory', Config, {
          base: this.config,
          applies: 'live',
          validate: (value) => {
            if (Object.keys(value).some((key) => !Object.hasOwn(Config({}), key)))
              fail('invalid-config', 'Unknown memory setting')
          }
        })
        const update = (value) => {
          if (this.controller.signal.aborted) return
          this.config = Object.fromEntries(Object.keys(Config({})).map((key) => [key, value[key]]))
          this.store.policy = Object.fromEntries(
            Object.keys(DEFAULT_POLICY).map((key) => [key, this.config[key]])
          )
          for (const listener of this.store.listeners) listener()
        }
        update(section.get())
        const unwatch = section.watch(update)
        settingsCtx.effect(() => unwatch)
        this.settings = settingsCtx.settings
        settingsCtx.effect(() => () => {
          this.settings = undefined
        })
      }
    } catch (error) {
      await this.domain?.close()
      await this.release()
      throw error
    }
  }
  fromAgent(agent, signal) {
    if (!this.ready || this.controller.signal.aborted) fail('disposed', 'Memory is unavailable')
    const session = agent?.session
    if (!session) fail('scope-unavailable', 'A Host session is required')
    const p = project(session.header.cwd)
    return {
      principal: 'owner',
      kind: 'agent',
      scope: p.key,
      root: p.root,
      session: String(session.id ?? session.header.id),
      signal: AbortSignal.any([this.controller.signal, ...(signal ? [signal] : [])])
    }
  }
  fromCwd(cwd, signal) {
    const p = project(cwd)
    return {
      principal: 'owner',
      kind: 'host',
      scope: p.key,
      root: p.root,
      signal: AbortSignal.any([this.controller.signal, ...(signal ? [signal] : [])])
    }
  }
  reviewer(scope, signal) {
    if (scope !== 'global' && !this.store.backend.get(scope))
      fail('scope-denied', 'Choose a known Host project scope')
    return {
      principal: 'owner',
      kind: 'operator',
      scope,
      root: this.store.backend.get(scope)?.root ?? '',
      signal: AbortSignal.any([this.controller.signal, ...(signal ? [signal] : [])])
    }
  }
  policyStatus() {
    const descriptor = this.settings?.describe().find((d) => d.ns === 'strique-memory')
    return {
      value: { ...this.config },
      revision: descriptor?.revision ?? null,
      writable: !!descriptor
    }
  }
  async savePolicy(caller, { value, revision }) {
    operator(caller)
    if (!this.settings || !Number.isSafeInteger(revision))
      fail('settings-unavailable', 'Settings service and current revision are required')
    if (
      !value ||
      typeof value !== 'object' ||
      Object.keys(value).some(
        (k) =>
          ![
            'read',
            'capture',
            'mutate',
            'publish',
            'export',
            'remoteEgress',
            'recallBytes'
          ].includes(k)
      )
    )
      fail('invalid-input', 'Unknown policy setting')
    await this.settings.replace('strique-memory', Config(value), revision)
    return this.policyStatus()
  }
  track(value) {
    const promise = Promise.resolve(value)
    this.jobs.add(promise)
    promise.finally(() => this.jobs.delete(promise)).catch(() => {})
    return promise
  }
  async dispose() {
    this.ready = false
    this.controller.abort()
    await Promise.allSettled([...this.jobs])
    await this.store?.close()
    await this.release?.()
  }
}
