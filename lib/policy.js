import { createHash } from 'node:crypto'
import { realpathSync, existsSync, statSync } from 'node:fs'
import { dirname, isAbsolute, join } from 'node:path'

export class MemoryError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'MemoryError'
    this.code = code
  }
}
export function fail(code, message) {
  throw new MemoryError(code, message)
}
export const digest = (value) =>
  createHash('sha256')
    .update(typeof value === 'string' ? value : JSON.stringify(value))
    .digest('hex')
export const clone = (value) => structuredClone(value)
export function text(value, max = 16384) {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    Buffer.byteLength(value) > max ||
    value.includes('\0')
  )
    fail('invalid-input', 'Text is empty, invalid, or exceeds its byte limit')
  return value.trim()
}
const secretPatterns = [
  /\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16})\b/g,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?(?:-----END[^\n]*|$)/g,
  /\b(?:api[_ -]?key|access[_ -]?token|password|secret|authorization)\s*[:=]\s*["']?(?:Bearer\s+)?[^\s"',;]{8,}/gi,
  /\bBearer\s+[A-Za-z0-9._~+\/-]{12,}=*/gi,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g
]
export function redact(value) {
  let out = String(value)
  for (const pattern of secretPatterns) out = out.replace(pattern, '[REDACTED]')
  return out
}
export function safe(value) {
  const inspect = (v, key = '') => {
    if (typeof v === 'string') {
      if (redact(v) !== v || redact(key + '=' + v) !== key + '=' + v)
        fail(
          'secret-detected',
          'Possible credential detected; remove it before saving or exporting'
        )
    } else if (v && typeof v === 'object') {
      for (const [k, item] of Object.entries(v)) {
        if (redact(k) !== k) fail('secret-detected', 'Possible credential in field name')
        inspect(item, k)
      }
    }
  }
  inspect(value)
  return value
}
export function jsonSize(value, limit = 1024 * 1024) {
  if (Buffer.byteLength(JSON.stringify(value)) > limit)
    fail('quota', 'Payload exceeds its byte limit')
  return value
}
export function project(cwd) {
  if (typeof cwd !== 'string' || !isAbsolute(cwd))
    fail('scope-unavailable', 'A Host session with an absolute working directory is required')
  let root
  try {
    root = realpathSync(cwd)
    if (!statSync(root).isDirectory()) throw new Error('Not a directory')
  } catch {
    fail('scope-unavailable', 'Project directory is unavailable')
  }
  let dir = root
  while (true) {
    if (existsSync(join(dir, '.git'))) {
      root = dir
      break
    }
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return { key: 'project-' + digest(root).slice(0, 24), root }
}
export const DEFAULT_POLICY = Object.freeze({
  read: true,
  capture: true,
  mutate: true,
  publish: true,
  export: true,
  remoteEgress: false
})
export function authorize(caller, action, policy = DEFAULT_POLICY) {
  if (
    !caller ||
    caller.principal !== 'owner' ||
    !/^(project-[a-f0-9]{24}|global)$/.test(caller.scope ?? '')
  )
    fail('scope-denied', 'A trusted scoped caller is required')
  if (policy[action] !== true) fail('policy-denied', `${action} is disabled`)
  caller.signal?.throwIfAborted()
}
export function operator(caller) {
  if (caller?.kind !== 'operator')
    fail('operator-required', 'This operation requires the authenticated local reviewer')
}
export function errorResult(error) {
  return {
    ok: false,
    error: {
      code: error instanceof MemoryError ? error.code : 'unavailable',
      message: error instanceof MemoryError ? error.message : 'Operation unavailable',
      details: {}
    }
  }
}
