import { safe, authorize, fail } from './policy.js'
import { validatePackage } from './store.js'

export class LearningWorker {
  constructor(store, generate, options = {}) {
    this.store = store
    this.generate = generate
    this.dailyTokens = options.dailyTokens ?? 20000
    this.maxTokens = options.maxTokens ?? 2048
    this.timeoutMs = options.timeoutMs ?? 60000
    this.inputBytes = options.inputBytes ?? 12288
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
      if (!this.store.policy.capture) continue
      try {
        await this.store.maintainQueue(caller)
        for (const expired of state.jobs.filter(
          (j) => j.state === 'pending' && (j.deadline < Date.now() || j.attempts >= 3)
        ))
          await this.mark(caller, expired.id, 'failed', 'deadline-or-attempt-limit')
        if (state.paused) continue
        const job = this.store
          .state(caller, 'capture')
          .jobs.find((j) => j.state === 'pending' && j.nextAt <= Date.now())
        if (!job) {
          await this.store.autoAdmit(caller)
          continue
        }
        if (job.deadline < Date.now() || job.attempts >= 3) {
          await this.mark(caller, job.id, 'failed', 'deadline-or-attempt-limit')
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
        await this.store.commit(caller, 'capture', async (s) => {
          const j = s.jobs.find((j) => j.id === job.id)
          if (!j || j.state !== 'pending' || s.paused) return
          if (j.deadline < Date.now() || j.attempts >= 3) {
            j.state = 'failed'
            j.error = 'deadline-or-attempt-limit'
            return
          }
          if (
            j.target &&
            !s.publications.some(
              (p) => p.name === j.target.name && p.active === j.target.hash && !p.archived
            )
          ) {
            j.state = 'failed'
            j.error = 'stale-target'
            return
          }
          const evidence = s.evidence.filter((e) => j.evidence.includes(e.id) && !e.revoked)
          if (evidence.length !== j.evidence.length) {
            j.state = 'failed'
            j.error = 'evidence-revoked'
            return
          }
          const day = new Date().toISOString().slice(0, 10)
          if (s.budget.day !== day) s.budget = { day, reserved: 0, used: 0, unknown: 0 }
          // UTF-8 bytes are a conservative input-token reservation, including a fixed prompt margin.
          if (!this.store.policy.read) {
            j.error = 'memory-read-disabled'
            j.nextAt = Date.now() + 60000
            return
          }
          const baseSkills = []
          for (const p of s.publications
            .filter((p) => p.active && !p.archived && (!j.target || p.name === j.target.name))
            .slice(-8))
            baseSkills.push({
              name: p.name,
              hash: p.active,
              package: await this.store.load(caller, p.name, p.active)
            })
          const facts = s.facts
            .filter((f) => f.status === 'active')
            .slice(-32)
            .map(({ id, revision, content }) => ({ id, revision, content }))
          const outcomes = s.outcomes
            .filter((o) => baseSkills.some((p) => p.hash === o.hash))
            .slice(-16)
          const decisions = s.candidates
            .filter((c) => c.decision)
            .slice(-8)
            .map((c) => ({
              name: c.package.name,
              hash: c.hash,
              status: c.status,
              reason: c.decision.reason
            }))
          const context = {
            evidence,
            route,
            baseSkills,
            facts,
            outcomes,
            decisions,
            review: { reason: j.reason, from: j.from, to: j.to, target: j.target ?? null }
          }
          const reserve = Buffer.byteLength(JSON.stringify(context)) + this.maxTokens + 2048
          if (reserve - this.maxTokens - 2048 > this.inputBytes || reserve > this.dailyTokens) {
            j.state = 'failed'
            j.error = 'input-budget-exceeded'
            return
          }
          if (s.budget.reserved + reserve > this.dailyTokens) {
            j.error = 'daily-token-budget'
            j.nextAt = Date.now() + 60000
            return
          }
          s.budget.reserved += reserve
          s.budget.unknown++
          j.reservedTokens = reserve
          j.attempts++
          j.state = 'running'
          j.route = route.provider + '/' + route.model
          j.error = ''
          selected = context
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
          const usage = result.usage?.totalTokens
          if (Number.isSafeInteger(usage) && usage >= 0)
            await this.store.commit(caller, 'capture', (s) => {
              s.budget.used += usage
              s.budget.unknown = Math.max(0, s.budget.unknown - 1)
            })
          safe(result)
          const output = result.output ?? result
          await this.store.commit(caller, 'capture', (s) => {
            authorize(caller, 'remoteEgress', this.store.policy)
            const j = s.jobs.find((j) => j.id === job.id)
            if (
              !j ||
              j.state !== 'running' ||
              s.paused ||
              (j.target &&
                !s.publications.some(
                  (p) => p.name === j.target.name && p.active === j.target.hash && !p.archived
                ))
            )
              fail('job-canceled', 'Job no longer owns its result')
            if (!Array.isArray(output.candidates) || output.candidates.length > 3)
              fail('invalid-model-output', 'Expected at most 3 candidates')
            if (!Array.isArray(output.facts ?? []) || (output.facts ?? []).length > 8)
              fail('invalid-model-output', 'Expected at most 8 factual proposals')
            for (const fact of output.facts ?? []) {
              if (
                !Array.isArray(fact.evidence) ||
                fact.evidence.some((id) => !j.evidence.includes(id))
              )
                fail('invalid-model-output', 'Fact references evidence outside this job')
              this.store.addFactCandidate(s, fact)
            }
            for (const c of output.candidates) {
              if (!Array.isArray(c.evidence) || c.evidence.some((id) => !j.evidence.includes(id)))
                fail('invalid-model-output', 'Candidate references evidence outside this job')
              if (
                !Array.isArray(c.facts ?? []) ||
                (c.facts ?? []).some(
                  (ref) =>
                    !selected.facts.some((f) => f.id === ref.id && f.revision === ref.revision)
                )
              )
                fail('invalid-model-output', 'Candidate references facts outside its context')
              this.store.addCandidate(s, validatePackage(c.package), {
                evidence: c.evidence,
                facts: c.facts ?? [],
                base: c.base ?? null
              })
            }
            j.state = 'done'
            j.error = ''
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
      } catch (error) {
        if (this.controller.signal.aborted) return
        // A broken scope remains inspectable while other projects continue.
        for (const job of state.jobs
          .filter((j) => ['pending', 'running'].includes(j.state))
          .slice(0, 1))
          await this.mark(
            caller,
            job.id,
            'pending',
            error?.code ?? 'scope-unavailable',
            60000
          ).catch(() => {})
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
