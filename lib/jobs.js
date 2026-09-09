import { safe, authorize, fail } from './policy.js'
import { validatePackage } from './store.js'

export class LearningWorker {
  constructor(store, generate, options = {}) {
    this.store = store
    this.generate = generate
    this.dailyTokens = options.dailyTokens ?? 20000
    this.maxTokens = options.maxTokens ?? 2048
    this.timeoutMs = options.timeoutMs ?? 60000
    this.controller = new AbortController()
    this.running = null
  }
  caller(scope, root) {
    return { principal: 'owner', kind: 'host', scope, root, signal: this.controller.signal }
  }
  async recover() {
    for (const [scope, state] of this.store.backend.entries()) {
      const caller = this.caller(scope, state.root)
      await this.store.commit(caller, 'capture', (s) => {
        for (const j of s.jobs)
          if (j.state === 'running') {
            j.state = 'pending'
            j.error = 'interrupted; previous token reservation retained'
            j.nextAt = 0
          }
      })
    }
  }
  tick() {
    if (this.running || this.controller.signal.aborted) return this.running ?? Promise.resolve()
    const task = this.run()
    this.running = task.finally(() => {
      this.running = null
    })
    return this.running
  }
  async run() {
    for (const [scope, state] of this.store.backend.entries()) {
      if (this.controller.signal.aborted) return
      const caller = this.caller(scope, state.root)
      if (state.paused) continue
      const job = state.jobs.find((j) => j.state === 'pending' && j.nextAt <= Date.now())
      if (!job) {
        await this.store.autoAdmit(caller)
        continue
      }
      if (!this.store.policy.remoteEgress) {
        await this.mark(caller, job.id, 'pending', 'remote-egress-disabled', 60000)
        continue
      }
      const route = this.generate.route()
      if (!route) {
        await this.mark(caller, job.id, 'pending', 'model-route-unavailable', 60000)
        continue
      }
      let selected
      await this.store.commit(caller, 'capture', (s) => {
        const j = s.jobs.find((j) => j.id === job.id)
        if (!j || j.state !== 'pending' || s.paused) return
        if (j.deadline < Date.now() || j.attempts >= 3) {
          j.state = 'failed'
          j.error = 'deadline-or-attempt-limit'
          return
        }
        const evidence = s.evidence.filter((e) => j.evidence.includes(e.id) && !e.revoked)
        if (evidence.length !== j.evidence.length) {
          j.state = 'failed'
          j.error = 'evidence-revoked'
          return
        }
        const day = new Date().toISOString().slice(0, 10)
        if (s.budget.day !== day) s.budget = { day, reserved: 0, used: 0 }
        // UTF-8 bytes are a conservative input-token reservation, including a fixed prompt margin.
        const baseSkills = s.publications
          .filter((p) => p.active && !p.archived)
          .map((p) => ({ name: p.name, hash: p.active }))
        const reserve =
          Buffer.byteLength(JSON.stringify({ evidence, route, baseSkills })) + this.maxTokens + 2048
        if (s.budget.reserved + reserve > this.dailyTokens) {
          j.error = 'daily-token-budget'
          j.nextAt = Date.now() + 60000
          return
        }
        s.budget.reserved += reserve
        j.reservedTokens = reserve
        j.attempts++
        j.state = 'running'
        j.route = route.provider + '/' + route.model
        j.error = ''
        selected = {
          evidence,
          route,
          baseSkills
        }
      })
      if (!selected) continue
      try {
        authorize(caller, 'remoteEgress', this.store.policy)
        safe(selected)
        const jobController = new AbortController()
        const unwatch = this.store.onChange(() => {
          if (
            this.store.backend.get(scope)?.paused ||
            !this.store.policy.capture ||
            !this.store.policy.remoteEgress
          )
            jobController.abort()
        })
        const signal = AbortSignal.any([
          this.controller.signal,
          jobController.signal,
          AbortSignal.timeout(this.timeoutMs)
        ])
        // Race also settles if a provider fails to honor cancellation. Late results cannot commit.
        let onAbort
        const aborted = new Promise((_, reject) => {
          onAbort = () => reject(signal.reason)
          signal.addEventListener('abort', onAbort, { once: true })
          if (signal.aborted) onAbort()
        })
        let result
        try {
          result = await Promise.race([
            this.generate.run(selected, { signal, maxTokens: this.maxTokens }),
            aborted
          ])
        } finally {
          signal.removeEventListener('abort', onAbort)
          unwatch()
        }
        signal.throwIfAborted()
        safe(result)
        await this.store.commit(caller, 'capture', (s) => {
          authorize(caller, 'remoteEgress', this.store.policy)
          const j = s.jobs.find((j) => j.id === job.id)
          if (!j || j.state !== 'running' || s.paused)
            fail('job-canceled', 'Job no longer owns its result')
          if (!Array.isArray(result.candidates) || result.candidates.length > 3)
            fail('invalid-model-output', 'Expected at most 3 candidates')
          for (const c of result.candidates) {
            if (!Array.isArray(c.evidence) || c.evidence.some((id) => !j.evidence.includes(id)))
              fail('invalid-model-output', 'Candidate references evidence outside this job')
            this.store.addCandidate(s, validatePackage(c.package), {
              evidence: c.evidence,
              facts: [],
              base: c.base ?? null
            })
          }
          j.state = 'done'
          j.error = ''
          s.budget.used += Math.min(
            Number.isSafeInteger(result.tokens) && result.tokens >= 0
              ? result.tokens
              : j.reservedTokens,
            j.reservedTokens
          )
        })
        await this.store.autoAdmit(caller)
      } catch (error) {
        if (this.controller.signal.aborted) return
        await this.mark(
          caller,
          job.id,
          job.attempts + 1 >= 3 ? 'failed' : 'pending',
          error?.code ?? 'provider-failed',
          Math.min(60000 * 2 ** job.attempts, 3600000)
        )
      }
    }
  }
  async mark(caller, id, state, error, delay = 0) {
    return this.store.commit(caller, 'capture', (s) => {
      const j = s.jobs.find((j) => j.id === id)
      if (j && j.state !== 'failed' && j.state !== 'done') {
        j.state = state
        j.error = String(error).slice(0, 256)
        j.nextAt = Date.now() + delay
      }
    })
  }
  async stop() {
    this.controller.abort()
    await this.running
  }
}
