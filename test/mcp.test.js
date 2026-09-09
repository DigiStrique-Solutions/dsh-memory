import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { fixture } from './helpers.js'
test('separate MCP persists canonical facts and refuses concurrent writers and model approval', async (t) => {
  const { root } = await fixture(t),
    env = {
      ...process.env,
      DSH_MEMORY_MODE: 'separate',
      DSH_MEMORY_DIR: root,
      DSH_MEMORY_PROJECT: root
    }
  const child = spawn(process.execPath, ['bin/dsh-memory-mcp.mjs'], {
    env,
    stdio: ['pipe', 'pipe', 'pipe']
  })
  let buffer = '',
    id = 0
  const waiting = new Map()
  child.stdout.on('data', (chunk) => {
    buffer += chunk
    while (buffer.includes('\n')) {
      const i = buffer.indexOf('\n'),
        message = JSON.parse(buffer.slice(0, i))
      buffer = buffer.slice(i + 1)
      waiting.get(message.id)?.(message)
    }
  })
  let stderr = ''
  child.stderr.on('data', (c) => (stderr += c))
  t.after(() => {
    if (child.exitCode === null) child.kill('SIGTERM')
  })
  const call = (method, params) =>
    new Promise((resolve) => {
      const key = ++id
      waiting.set(key, resolve)
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: key, method, params }) + '\n')
    })
  const init = await call('initialize', {})
  assert.equal(init.result.serverInfo.name, 'strique-memory-separate')
  const added = await call('tools/call', {
    name: 'memory_mutate',
    arguments: {
      op: 'add',
      content: 'MCP durable fact',
      expectedRevision: 0,
      idempotencyKey: 'mcp'
    }
  })
  assert.equal(added.result.isError, false, stderr)
  const read = await call('tools/call', { name: 'memory_read', arguments: {} })
  assert.equal(read.result.structuredContent.total, 1)
  const deny = await call('tools/call', { name: 'learning_decide', arguments: { approve: true } })
  assert.equal(deny.result.isError, true)
  const second = spawn(process.execPath, ['bin/dsh-memory-mcp.mjs'], { env, stdio: 'ignore' })
  const [code] = await once(second, 'exit')
  assert.notEqual(code, 0)
  child.stdin.end()
  const [exit] = await once(child, 'exit')
  assert.equal(exit, 0, stderr)
})

test('failed MCP initialization releases its own lock', async (t) => {
  const { root } = await fixture(t)
  const child = spawn(process.execPath, ['bin/dsh-memory-mcp.mjs'], {
    env: {
      ...process.env,
      DSH_MEMORY_MODE: 'separate',
      DSH_MEMORY_DIR: root,
      DSH_MEMORY_PROJECT: root + '/missing-project'
    },
    stdio: 'ignore'
  })
  const [code] = await once(child, 'exit')
  assert.notEqual(code, 0)
  const { access } = await import('node:fs/promises')
  await assert.rejects(access(root + '/.owner.lock'), { code: 'ENOENT' })
})
