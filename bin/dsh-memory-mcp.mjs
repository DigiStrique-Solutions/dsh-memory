#!/usr/bin/env node
import { resolve, join } from 'node:path'
import { once } from 'node:events'
import { homedir } from 'node:os'
import { FileBackend, Objects, acquireOwner } from '../lib/files.js'
import { MemoryStore } from '../lib/store.js'
import { project, errorResult, fail, safe } from '../lib/policy.js'

// This adapter deliberately cannot open the Host's store or approve procedures.
if (
  process.env.DSH_MEMORY_MODE !== 'separate' ||
  !process.env.DSH_MEMORY_DIR ||
  !process.env.DSH_MEMORY_PROJECT
) {
  process.stderr.write(
    'Set DSH_MEMORY_MODE=separate, DSH_MEMORY_DIR, and DSH_MEMORY_PROJECT. Host store sharing is unsupported.\n'
  )
  process.exit(1)
}
const root = resolve(process.env.DSH_MEMORY_DIR),
  hostRoot = resolve(process.env.DSH_HOME || join(homedir(), '.dsh'), 'strique-memory-v1')
if (root === hostRoot || root.startsWith(hostRoot + '/'))
  throw new Error('MCP must use a separate store')
const release = await acquireOwner(root)
const backend = new FileBackend(root)
const objects = new Objects(root)
const controller = new AbortController()
let store, caller
try {
  await backend.init()
  await objects.init()
  store = new MemoryStore(backend, objects, {
    policy: { capture: false, publish: false, export: false, remoteEgress: false }
  })
  const scope = project(process.env.DSH_MEMORY_PROJECT)
  caller = {
    principal: 'owner',
    kind: 'agent',
    scope: scope.key,
    root: scope.root,
    session: 'mcp',
    signal: controller.signal
  }
} catch (error) {
  await backend.close()
  await release()
  throw error
}
const definitions = [
  {
    name: 'memory_read',
    description: 'Read active facts in the configured project',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        offset: { type: 'integer' },
        limit: { type: 'integer' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'memory_search',
    description: 'Search the configured project only',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        limit: { type: 'integer' }
      },
      required: ['query'],
      additionalProperties: false
    }
  },
  {
    name: 'memory_mutate',
    description: 'Mutate one fact with expected revision and replay key',
    inputSchema: {
      type: 'object',
      properties: {
        op: { type: 'string', enum: ['add', 'update', 'delete', 'archive', 'restore'] },
        id: { type: 'string' },
        content: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        expectedRevision: { type: 'integer' },
        idempotencyKey: { type: 'string' }
      },
      required: ['op', 'expectedRevision', 'idempotencyKey'],
      additionalProperties: false
    }
  },
  {
    name: 'memory_stats',
    description: 'Inspect this separate store',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  }
]
let pending = Promise.resolve(),
  buffer = '',
  closed = false,
  queued = 0
const send = async (value) => {
  if (closed) return
  const data = JSON.stringify(value) + '\n'
  if (Buffer.byteLength(data) > 2 * 1024 * 1024) fail('quota', 'Response exceeds limit')
  if (!process.stdout.write(data))
    await once(process.stdout, 'drain', { signal: controller.signal }).catch(() => {})
}
async function handle(message) {
  if (!message || message.jsonrpc !== '2.0' || !['string', 'number'].includes(typeof message.id))
    return
  try {
    let result
    if (message.method === 'initialize')
      result = {
        protocolVersion: '2024-11-05',
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'strique-memory-separate', version: '0.3.0-internal.1' }
      }
    else if (message.method === 'ping') result = {}
    else if (message.method === 'tools/list') result = { tools: definitions }
    else if (message.method === 'tools/call') {
      const d = definitions.find((t) => t.name === message.params?.name),
        a = message.params?.arguments ?? {}
      if (
        !d ||
        !a ||
        typeof a !== 'object' ||
        Array.isArray(a) ||
        Object.keys(a).some((k) => !(k in d.inputSchema.properties))
      )
        fail('invalid-input', 'Unknown tool or argument')
      const value = await store[d.name.slice(7)](caller, a)
      result = {
        content: [{ type: 'text', text: JSON.stringify(safe(value)) }],
        structuredContent: value,
        isError: false
      }
    } else {
      await send({
        jsonrpc: '2.0',
        id: message.id,
        error: { code: -32601, message: 'Method not found' }
      })
      return
    }
    await send({ jsonrpc: '2.0', id: message.id, result })
  } catch (e) {
    await send({
      jsonrpc: '2.0',
      id: message.id,
      result: { content: [{ type: 'text', text: JSON.stringify(errorResult(e)) }], isError: true }
    })
  }
}
process.stdin.setEncoding('utf8')
process.stdin.on('data', (chunk) => {
  if (closed) return
  buffer += chunk
  if (Buffer.byteLength(buffer) > 1024 * 1024) {
    process.stderr.write('Request buffer limit exceeded\n')
    void stop()
    return
  }
  while (buffer.includes('\n')) {
    const index = buffer.indexOf('\n'),
      line = buffer.slice(0, index)
    buffer = buffer.slice(index + 1)
    if (++queued > 64) {
      process.stderr.write('Request queue limit exceeded\n')
      void stop()
      return
    }
    pending = pending.then(async () => {
      try {
        return await handle(JSON.parse(line))
      } catch {
        await send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })
      } finally {
        queued--
      }
    })
  }
})
async function stop() {
  if (closed) return
  closed = true
  process.stdin.pause()
  controller.abort()
  await pending
  await store.close()
  await release()
}
process.stdin.on('end', () => void stop())
process.on('SIGINT', () => void stop())
process.on('SIGTERM', () => void stop())
