import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { handler, localRequest } from '../lib/web.js'
import { fixture } from './helpers.js'
test('HTTP requires actual auth and local transport, returns no credentials, enforces scope and operation allowlist', async (t) => {
  const { store, caller } = await fixture(t)
  const memory = {
    store,
    config: { recallBytes: 8192 },
    reviewer(scope, signal) {
      if (scope !== caller.scope && scope !== 'global') throw Error('denied')
      return { ...caller, scope, signal }
    }
  }
  const server = createServer(
    handler(memory, {
      requestRejection: (req) =>
        req.headers.authorization === 'Bearer synthetic-test-auth' ? undefined : 401
    })
  )
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise((r) => server.close(r)))
  const url = 'http://127.0.0.1:' + server.address().port
  const call = async (method, payload = {}, extra = {}) =>
    fetch(url + '/strique-memory/' + method, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer synthetic-test-auth',
        ...extra
      },
      body: JSON.stringify({ type: 'client-request', rpcId: '1', method, payload })
    })
  assert.equal((await call('scopes', {}, { authorization: '' })).status, 401)
  assert.equal((await call('scopes', {}, { 'x-forwarded-for': '192.0.2.1' })).status, 403)
  assert.equal(
    localRequest({ headers: { host: 'evil.example' }, socket: { remoteAddress: '127.0.0.1' } }),
    false
  )
  const value = await (await call('scopes')).json()
  assert.equal(value.result.ok, true)
  assert.ok(!JSON.stringify(value).includes('synthetic-test-auth'))
  assert.equal(
    (await (await call('shell', { command: 'echo nope' })).json()).result.error.code,
    'unknown-operation'
  )
  assert.equal((await (await call('read', { scope: 'arbitrary' })).json()).result.ok, false)
  assert.equal(
    (await (await call('decide', { approve: 'true' })).json()).result.error.code,
    'invalid-input'
  )
})

test('real DSH WebServer dispatches the prefix route and unload removes it', async (t) => {
  const { Context } = await import('@deepseek-ai/cordis'),
    { default: WebServer } = await import('@deepseek-ai/dsh-host-webserver'),
    { apply } = await import('../lib/web.js')
  const { store, caller } = await fixture(t),
    ctx = new Context()
  t.after(() => ctx.fiber.dispose())
  ctx.provide('striqueMemory', {
    store,
    config: { recallBytes: 8192 },
    reviewer: (_scope, signal) => ({ ...caller, signal })
  })
  ctx.provide('connection', { requestRejection: () => undefined })
  await ctx.plugin(WebServer, { host: '127.0.0.1', port: 0 })
  const fiber = ctx.plugin({
    name: 'test-memory-route',
    inject: ['webServer', 'striqueMemory', 'connection'],
    apply
  })
  await fiber
  const url = 'http://127.0.0.1:' + ctx.webServer.port + '/strique-memory/scopes'
  const request = () =>
    fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'client-request', rpcId: 'x', method: 'scopes', payload: {} })
    })
  assert.equal((await (await request()).json()).result.ok, true)
  await fiber.dispose()
  assert.equal((await request()).status, 404)
})
