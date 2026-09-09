import { constants } from 'node:fs'
import { open, mkdir, lstat, realpath, rename, unlink, readFile } from 'node:fs/promises'
import { join, resolve, dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { digest, fail, jsonSize, safe } from './policy.js'

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
export async function acquireOwner(root) {
  await privateDirectory(root)
  const path = join(root, '.owner.lock')
  let handle
  try {
    handle = await open(
      path,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600
    )
  } catch (e) {
    if (e.code === 'EEXIST')
      fail('store-owned', 'Store is already owned or needs explicit crash recovery')
    throw e
  }
  const token = randomUUID()
  const stat = await handle.stat()
  await handle.writeFile(JSON.stringify({ pid: process.pid, token, started: Date.now() }))
  await handle.sync()
  let released = false
  return async () => {
    if (released) return
    released = true
    try {
      const current = await lstat(path)
      if (
        current.ino === stat.ino &&
        current.dev === stat.dev &&
        JSON.parse(await readBounded(path, 1024)).token === token
      )
        await unlink(path)
    } catch (e) {
      if (e.code !== 'ENOENT') throw e
    } finally {
      await handle.close()
    }
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
