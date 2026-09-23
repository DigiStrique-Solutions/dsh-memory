import { constants } from 'node:fs'
import { open, mkdir, lstat, realpath, rename, unlink, readFile } from 'node:fs/promises'
import { join, resolve, dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { createConnection, createServer } from 'node:net'
import { digest, fail, jsonSize, safe } from './policy.js'

const OWNER_HOST = '127.0.0.1'
const OWNER_PORT_MIN = 20000
const OWNER_PORT_SPAN = 40000
const OWNER_PORT_CANDIDATES = 8
const OWNER_PROTOCOL = 'dsh-memory-owner:'

export async function privateDirectory(path) {
  const absolute = resolve(path)
  await mkdir(absolute, { recursive: true, mode: 0o700 })
  const resolved = await realpath(absolute)
  if (resolved !== absolute || !(await lstat(absolute)).isDirectory())
    fail('unsafe-path', 'Store must be a real directory without symlink components')
  return absolute
}
export async function readBounded(path, limit = 16 * 1024 * 1024) {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    const stat = await handle.stat()
    if (!stat.isFile() || stat.size > limit) fail('unsafe-file', 'Expected a bounded regular file')
    // Explicit maximum read also bounds a file that grows after stat.
    const bytes = Buffer.alloc(limit + 1)
    let size = 0
    while (size <= limit) {
      const r = await handle.read(bytes, size, bytes.length - size, size)
      if (!r.bytesRead) break
      size += r.bytesRead
    }
    if (size > limit) fail('quota', 'File exceeds its byte limit')
    return bytes.subarray(0, size).toString('utf8')
  } finally {
    await handle.close()
  }
}
export async function atomicWrite(path, value) {
  const temp = join(dirname(path), '.' + randomUUID() + '.tmp')
  const handle = await open(
    temp,
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
    0o600
  )
  try {
    await handle.writeFile(value)
    await handle.sync()
  } finally {
    await handle.close()
  }
  try {
    await rename(temp, path)
    const dir = await open(dirname(path), 'r')
    try {
      await dir.sync()
    } finally {
      await dir.close()
    }
  } finally {
    await unlink(temp).catch((e) => {
      if (e.code !== 'ENOENT') throw e
    })
  }
}
function ownerPort(id, index) {
  return OWNER_PORT_MIN + (Number.parseInt(digest(id + ':' + index).slice(0, 8), 16) % OWNER_PORT_SPAN)
}
function bindOwner(port, id) {
  return new Promise((resolve, reject) => {
    const server = createServer((socket) => {
      socket.on('error', () => {})
      socket.end(OWNER_PROTOCOL + id)
    })
    const error = (cause) => {
      server.close(() => {})
      if (cause.code === 'EADDRINUSE') resolve(null)
      else reject(cause)
    }
    server.once('error', error)
    server.listen({ host: OWNER_HOST, port, exclusive: true }, () => {
      server.off('error', error)
      server.on('error', () => {})
      server.unref()
      resolve(server)
    })
  })
}
function probeOwner(port, id) {
  return new Promise((resolve) => {
    let value = '',
      settled = false
    const socket = createConnection({ host: OWNER_HOST, port })
    const finish = (result) => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(result)
    }
    socket.setEncoding('utf8')
    socket.setTimeout(200, () => finish('unavailable'))
    socket.on('data', (chunk) => {
      value += chunk
      if (value.length > 256) finish('other')
    })
    socket.on('end', () => finish(value === OWNER_PROTOCOL + id ? 'same' : 'other'))
    socket.on('error', () => finish('unavailable'))
  })
}
export async function acquireOwner(root) {
  const absolute = await privateDirectory(root)
  const id = digest(absolute)
  let server
  for (let index = 0; index < OWNER_PORT_CANDIDATES; index++) {
    const port = ownerPort(id, index)
    server = await bindOwner(port, id)
    if (server) break
    const owner = await probeOwner(port, id)
    if (owner === 'same') fail('store-owned', 'Store is already owned by a live process')
    if (owner === 'unavailable') {
      server = await bindOwner(port, id)
      if (!server) fail('store-owned', 'The ownership lease cannot be verified safely')
    }
    if (server) break
  }
  if (!server) fail('store-owned', 'No local ownership lease is available for this store')
  let released = false
  return async () => {
    if (released) return
    released = true
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  }
}
export class Objects {
  constructor(root) {
    this.root = join(root, 'objects')
  }
  async init() {
    await privateDirectory(this.root)
  }
  async put(pkg) {
    const data = JSON.stringify(safe(jsonSize(pkg, 256 * 1024)))
    const hash = digest(data),
      path = join(this.root, hash + '.json')
    try {
      const handle = await open(
        path,
        constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
        0o600
      )
      try {
        await handle.writeFile(data)
        await handle.sync()
      } finally {
        await handle.close()
      }
    } catch (e) {
      if (e.code !== 'EEXIST') throw e
      if ((await readBounded(path, 256 * 1024)) !== data)
        fail('object-corrupt', 'Immutable object hash mismatch')
    }
    const directory = await open(this.root, 'r')
    try {
      await directory.sync()
    } finally {
      await directory.close()
    }
    return hash
  }
  async get(hash) {
    if (!/^[a-f0-9]{64}$/.test(hash)) fail('invalid-input', 'Invalid object hash')
    const raw = await readBounded(join(this.root, hash + '.json'), 256 * 1024)
    if (digest(raw) !== hash) fail('object-corrupt', 'Immutable object hash mismatch')
    return safe(JSON.parse(raw))
  }
}
// Separate-store MCP backend only. The Host uses storageDomain instead.
export class FileBackend {
  constructor(root) {
    this.root = root
    this.data = new Map()
  }
  async init() {
    try {
      const rows = JSON.parse(await readBounded(join(this.root, 'state.json')))
      if (!Array.isArray(rows)) fail('invalid-store', 'Invalid store')
      this.data = new Map(rows)
      if (this.data.size !== rows.length)
        fail('invalid-store', 'Duplicate scope records are invalid')
    } catch (e) {
      if (e.code !== 'ENOENT') throw e
    }
  }
  entries() {
    return [...this.data.entries()]
  }
  get(key) {
    return this.data.get(key)
  }
  async put(key, value) {
    const next = new Map(this.data)
    next.set(key, value)
    await atomicWrite(
      join(this.root, 'state.json'),
      JSON.stringify(jsonSize([...next], 16 * 1024 * 1024))
    )
    this.data = next
  }
  async close() {}
}
