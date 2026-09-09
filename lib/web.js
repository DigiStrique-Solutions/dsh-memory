import { packageDiff } from './diff.js'
import { errorResult, safe, fail, jsonSize } from './policy.js'
export const name = 'strique-memory-web'
export const inject = ['striqueMemory', 'webServer', 'connection']
export const ROUTE = '/strique-memory'
export function localRequest(req) {
  return (
    ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket?.remoteAddress) &&
    !Object.keys(req.headers).some((k) => k === 'forwarded' || k.startsWith('x-forwarded-')) &&
    /^(localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/.test(req.headers.host ?? '')
  )
}
async function readBody(req, signal) {
  let bytes = 0
  const chunks = []
  const cancel = () => req.destroy()
  signal.addEventListener('abort', cancel, { once: true })
  try {
    for await (const chunk of req) {
      signal.throwIfAborted()
      bytes += chunk.length
      if (bytes > 9 * 1024 * 1024) fail('quota', 'Request exceeds byte limit')
      chunks.push(chunk)
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } finally {
    signal.removeEventListener('abort', cancel)
  }
}
export function handler(memory, connection, lifetime = new AbortController().signal) {
  return async (req, res) => {
    const rejection = connection.requestRejection(req)
    if (rejection !== undefined || !localRequest(req)) {
      res.writeHead(rejection ?? 403)
      res.end('Access denied')
      return
    }
    if (req.method !== 'POST') {
      res.writeHead(405)
      res.end('Use POST')
      return
    }
    if (req.headers['content-type']?.split(';')[0] !== 'application/json') {
      res.writeHead(415)
      res.end('Use JSON')
      return
    }
    const disconnected = new AbortController(),
      abort = () => {
        if (!res.writableFinished) disconnected.abort()
      }
    req.once('aborted', abort)
    res.once('close', abort)
    const signal = AbortSignal.any([lifetime, disconnected.signal, AbortSignal.timeout(10000)])
    let rpcId = 'invalid'
    try {
      const envelope = await readBody(req, signal),
        method = (req.url ?? '').split('?')[0].slice((ROUTE + '/').length)
      if (
        envelope?.type !== 'client-request' ||
        typeof envelope.rpcId !== 'string' ||
        envelope.rpcId.length > 128 ||
        envelope.method !== method ||
        !envelope.payload ||
        typeof envelope.payload !== 'object'
      )
        fail('invalid-input', 'Invalid request envelope')
      rpcId = envelope.rpcId
      const a = envelope.payload,
        caller = memory.reviewer(a.scope ?? 'global', signal),
        store = memory.store
      let value
      switch (method) {
        case 'settings':
          value = await memory.savePolicy(caller, a)
          break
        case 'scopes':
          value = {
            scopes: store.scopes(caller),
            policy: { ...store.policy },
            recallBytes: memory.config.recallBytes,
            admission: 'reviewed-by-default',
            settings: memory.policyStatus?.() ?? null
          }
          break
        case 'read':
          value = store.read(caller, a)
          break
        case 'search':
          value = store.search(caller, a)
          break
        case 'stats':
          value = store.stats(caller)
          break
        case 'mutate':
          value = await store.mutate(caller, a)
          break
        case 'export':
          value = store.export(caller)
          break
        case 'import':
          value = await store.import(caller, a)
          break
        case 'review': {
          value = store.review(caller, a)
          if (a.id)
            value.previous = value.candidate.base
              ? await store.objects.get(value.candidate.base)
              : null
          if (a.id) value.diff = packageDiff(value.previous, value.candidate.package)
          break
        }
        case 'evidence':
          value = { evidence: store.evidence(caller) }
          break
        case 'validate':
          value = await store.validate(caller, a)
          break
        case 'decide':
          if (typeof a.approve !== 'boolean') fail('invalid-input', 'approve must be boolean')
          value = await store.decide(caller, a)
          break
        case 'maintain':
          value = await store.maintain(caller, a)
          break
        case 'maintenance':
          value = await store.maintenance(caller)
          break
        case 'revoke-evidence':
          value = await store.revokeEvidence(caller, a.id)
          break
        case 'outcome':
          value = await store.outcome(caller, a)
          break
        case 'autonomy':
          value = await store.configureAutonomy(caller, a)
          break
        case 'pause':
          value = await store.pause(caller, a.paused)
          break
        default:
          fail('unknown-operation', 'Unknown operation')
      }
      respond({ ok: true, value: safe(jsonSize(value ?? {}, 9 * 1024 * 1024)) })
    } catch (e) {
      respond(errorResult(e))
    } finally {
      req.off('aborted', abort)
      res.off('close', abort)
    }
    function respond(result) {
      if (res.destroyed || res.writableEnded) return
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'"
      })
      res.end(JSON.stringify({ type: 'server-response', rpcId, result }))
    }
  }
}
export function apply(ctx) {
  const lifetime = new AbortController(),
    pending = new Set(),
    route = handler(ctx.striqueMemory, ctx.connection, lifetime.signal)
  const unregister = ctx.webServer.register({
    kind: 'prefix',
    path: ROUTE,
    handler(req, res) {
      const p = route(req, res)
      pending.add(p)
      p.finally(() => pending.delete(p)).catch(() => {})
      return p
    }
  })
  ctx.effect(() => async () => {
    unregister()
    lifetime.abort()
    await Promise.allSettled([...pending])
  })
}
