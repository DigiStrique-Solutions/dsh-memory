import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Host-wiring guards: the harness-facing surface of lib/index.js changed under
// the plugin's feet on the DSH 0.1.x line (dsh-settings@0.1.2-rc.1 removed the
// settingsNamespace helper export; the settings namespace is now a bare string).
// These tests keep the host wiring intentionally narrow and observable, so a
// future DSH API drift is caught in CI instead of only at host load time.

const TOOL_NAMES = [
  'memory_read', 'memory_add', 'memory_update', 'memory_delete', 'memory_search',
  'memory_merge', 'memory_review', 'memory_export', 'memory_import', 'memory_stats',
  'memory_browse', 'memory_history', 'memory_rollback', 'memory_sync'
]

test('host wiring: settings namespace is a bare string, not a settingsNamespace helper', async () => {
  const source = await readFile(new URL('../lib/index.js', import.meta.url), 'utf8')
  assert.match(source, /settings\.register\(\s*'[a-z0-9-]+'\s*,/,
    'settings.register must take the namespace as a plain string (DSH 0.1.2-rc.1 drops settingsNamespace)')
  assert.doesNotMatch(source, /settingsNamespace/,
    'the removed settingsNamespace helper must not be imported or used')
})

test('host wiring: exposes the full tool surface, the turn hook, and the skill', async () => {
  const source = await readFile(new URL('../lib/index.js', import.meta.url), 'utf8')
  for (const name of TOOL_NAMES) {
    assert.match(source, new RegExp(`name:\\s*'${name}'`), `missing tool definition ${name}`)
  }
  assert.match(source, /agent\/turn-stopping/, 'must subscribe to agent/turn-stopping for auto-summarization')
  assert.match(source, /systemPrompt\.context\(/, 'must install a systemPrompt.context injection')
  assert.match(source, /AUTO_MEMORY_SKILL/, 'must register the auto-memory runtime skill')
})

test('host wiring: reads session events through the Surface layer', async () => {
  const source = await readFile(new URL('../lib/index.js', import.meta.url), 'utf8')
  assert.match(source, /\.snapshotEvents\(/,
    'must call session.snapshotEvents (DSH 0.1.2-rc.1 replaced Session.events with the Surface layer)')
  assert.doesNotMatch(source, /\.events\.entries\(\)/,
    'must not call session.events.entries() (removed in DSH 0.1.2-rc.1; throws on every turn summarization)')
})

// apply() smoke: drives the real plugin entry through a fake cordis ctx and
// asserts the host wiring actually registers everything. Imports the harness
// packages (dsh-llm / dsh-tools) transitively, so it only runs where they are
// resolvable; in zero-dependency CI it skips so the suite stays green.
test('host wiring: apply() registers the memory settings, 14 tools, the skill, and the injection hook', async (t) => {
  let plugin
  try {
    plugin = await import('../lib/index.js')
  } catch {
    t.skip('harness packages (@deepseek-ai/dsh-llm, @deepseek-ai/dsh-tools) not resolvable here')
    return
  }

  const tmpDir = mkdtempSync(join(tmpdir(), 'dsh-memory-smoke-'))
  const cleanups = []
  const hook = { settings: null, tools: [], skills: [], routes: [], systemPrompt: null, turnStopping: null }

  const fakeSettings = {
    register(namespace, config, opts) {
      hook.settings = { namespace, config, opts }
      return { get: () => config, watch: () => () => {} }
    },
    describe: () => [{ ns: 'memory', value: {}, base: {}, user: {}, revision: 0 }],
    writable: true,
    replace: async () => {}
  }

  const fakeCtx = {
    logger: { info: () => {}, warn: () => {}, error: () => {} },
    settings: fakeSettings,
    tools: null,
    skills: null,
    webServer: null,
    get(name) {
      if (name === 'systemPrompt') {
        return {
          context: (cfg) => {
            hook.systemPrompt = cfg
            return () => {}
          }
        }
      }
      return undefined
    },
    inject(names, cb) {
      if (names.includes('settings')) this.settings = fakeSettings
      if (names.includes('tools')) this.tools = { register: (def) => { hook.tools.push(def); return () => {} } }
      if (names.includes('skills')) this.skills = { register: (skill) => { hook.skills.push(skill); return () => {} } }
      if (names.includes('webServer')) this.webServer = { register: (route) => { hook.routes.push(route); return () => {} } }
      cb(this)
    },
    on(event, handler) {
      hook.turnStopping = handler
      return () => {}
    },
    effect(fn) {
      const dispose = fn()
      if (typeof dispose === 'function') cleanups.push(dispose)
      return dispose
    }
  }

  try {
    plugin.apply(fakeCtx, { memoryDir: tmpDir, autoSummarize: false, seedFromAgentsMd: false })

    assert.equal(hook.settings.namespace, 'memory', 'settings namespace must be the bare string "memory"')
    assert.equal(hook.tools.length, TOOL_NAMES.length, 'all memory_* tools must be registered')
    assert.deepEqual(hook.tools.map((def) => def.name).sort(), TOOL_NAMES.slice().sort())
    assert.ok(hook.skills.some((skill) => skill.name === 'auto-memory'), 'auto-memory skill must be registered')
    assert.equal(hook.systemPrompt.name, 'dsh-memory', 'systemPrompt.context must be installed with name dsh-memory')
    assert.equal(hook.systemPrompt.order, 2000)
    assert.equal(typeof hook.turnStopping, 'function', 'agent/turn-stopping handler must be subscribed')
    assert.ok(hook.routes.length >= 1, 'the same-origin settings route must be registered')
  } finally {
    for (const dispose of cleanups) {
      try { dispose() } catch { /* ignore disposal errors */ }
    }
    rmSync(tmpDir, { recursive: true, force: true })
  }
})
