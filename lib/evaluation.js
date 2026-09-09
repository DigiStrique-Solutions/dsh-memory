import { fail, digest, safe, jsonSize } from './policy.js'
export const SAFETY_CASES = [
  'scope-isolation',
  'secret-screening',
  'stale-approval',
  'writer-ownership',
  'revocation',
  'cancellation',
  'replay',
  'restart',
  'protected-skills',
  'resources',
  'authentication',
  'migration',
  'evidence-trust',
  'output-bounds',
  'publication-rollback'
]
export const MODES = ['none', 'memory', 'learning']
// Recompute the gate from trial observations. A saved 'passed' boolean is never authority.
export function assessEvaluation(report) {
  safe(jsonSize(report, 1024 * 1024))
  if (
    report?.format !== 'strique-memory-evaluation' ||
    report.version !== 1 ||
    report.liveModel !== true ||
    !Array.isArray(report.trials) ||
    report.trials.length < 90
  )
    fail('evaluation-required', 'At least 30 held-out live-model trials per mode are required')
  if (
    typeof report.model !== 'string' ||
    !report.model ||
    typeof report.corpusHash !== 'string' ||
    !/^[a-f0-9]{64}$/.test(report.corpusHash)
  )
    fail('evaluation-required', 'Pin the model and corpus hash')
  if (
    !Array.isArray(report.safety) ||
    SAFETY_CASES.some((name) => !report.safety.some((s) => s.name === name && s.passed === true)) ||
    report.safety.some((s) => s.passed !== true)
  )
    fail('evaluation-required', 'All deterministic safety fixtures must pass')
  const stats = {}
  for (const mode of MODES) {
    const trials = report.trials.filter((t) => t.mode === mode)
    if (
      trials.length < 30 ||
      trials.some(
        (t) =>
          t.heldOut !== true ||
          typeof t.success !== 'boolean' ||
          !Number.isFinite(t.tokens) ||
          t.tokens < 0 ||
          !Number.isFinite(t.latencyMs) ||
          t.latencyMs < 0 ||
          typeof t.id !== 'string'
      )
    )
      fail('evaluation-required', 'Trials need held-out oracles, token usage, and latency')
    if (new Set(trials.map((t) => t.id)).size !== trials.length)
      fail('evaluation-required', 'Trial IDs must be distinct within each mode')
    stats[mode] = {
      n: trials.length,
      success: trials.filter((t) => t.success).length,
      meanTokens: trials.reduce((a, t) => a + t.tokens, 0) / trials.length,
      meanLatencyMs: trials.reduce((a, t) => a + t.latencyMs, 0) / trials.length
    }
  }
  for (const value of Object.values(stats)) {
    const p = value.success / value.n,
      z2 = 1.96 ** 2,
      denominator = 1 + z2 / value.n
    const center = (p + z2 / (2 * value.n)) / denominator
    const margin =
      (1.96 * Math.sqrt((p * (1 - p)) / value.n + z2 / (4 * value.n ** 2))) / denominator
    value.successRate = p
    value.wilson95 = [Math.max(0, center - margin), Math.min(1, center + margin)]
  }
  const memory = report.trials.filter((t) => t.mode === 'memory'),
    learning = report.trials.filter((t) => t.mode === 'learning')
  if (
    MODES.some(
      (mode) =>
        report.trials
          .filter((t) => t.mode === mode)
          .map((t) => t.id)
          .sort()
          .join('\n') !==
        memory
          .map((t) => t.id)
          .sort()
          .join('\n')
    )
  )
    fail('evaluation-required', 'Modes must cover the same held-out trial IDs')
  let wins = 0,
    losses = 0
  for (const learned of learning) {
    const baseline = memory.find((t) => t.id === learned.id)
    if (learned.success && !baseline.success) wins++
    if (!learned.success && baseline.success) losses++
  }
  // Conservative paired gate: at least six improvements and no unexplained regression.
  if (wins < 6 || losses > 0)
    fail(
      'evaluation-required',
      'Learning must improve at least six paired held-out trials with no unexplained regression'
    )
  return {
    hash: digest(report),
    model: report.model,
    corpusHash: report.corpusHash,
    stats,
    wins,
    losses,
    pairedSignTestP: 2 ** -wins
  }
}
