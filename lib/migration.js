import { join } from 'node:path'
import { readdir, realpath } from 'node:fs/promises'
import { readBounded } from './files.js'
import { safe, digest, fail } from './policy.js'
// Legacy Markdown has no escaping contract. Ambiguous boundaries are quarantined, never silently trusted.
export async function migrationPreview(directory) {
  const root = await realpath(directory),
    files = ['raw_memories.md']
  try {
    for (const name of await readdir(join(root, 'archive')))
      if (/^raw-\d{4}-\d{2}\.md$/.test(name)) files.push('archive/' + name)
  } catch (e) {
    if (e.code !== 'ENOENT') throw e
  }
  if (files.length > 120) fail('quota', 'Too many legacy archive files')
  const facts = [],
    quarantine = [],
    checksums = [],
    ids = new Map()
  let total = 0
  for (const file of files) {
    let content
    try {
      content = await readBounded(join(root, file), 2 * 1024 * 1024)
    } catch (e) {
      if (e.code === 'ENOENT') continue
      throw e
    }
    total += Buffer.byteLength(content)
    if (total > 8 * 1024 * 1024) fail('quota', 'Legacy source exceeds migration limit')
    checksums.push({ file, sha256: digest(content) })
    const blocks = content.split(/(?=^### )/m).filter((b) => b.startsWith('### '))
    for (let index = 0; index < blocks.length; index++) {
      const block = blocks[index],
        key = file + ':' + index
      const match =
        /^### ([^\n]+)\n\n?\*\*id:\*\* ([^\n]+)\n\*\*tags:\*\* ([^\n]*)\n\*\*importance:\*\* ([0-3])\n\n([\s\S]*)$/.exec(
          block
        )
      if (
        !match ||
        !Number.isFinite(Date.parse(match[1])) ||
        /^(?:### |\*\*(?:id|tags|importance):)/m.test(match?.[5] ?? '')
      ) {
        quarantine.push({ source: key, reason: 'ambiguous-markdown', sha256: digest(block) })
        continue
      }
      try {
        safe(block)
      } catch {
        quarantine.push({ source: key, reason: 'credential-detected', sha256: digest(block) })
        continue
      }
      const id = match[2].trim(),
        entry = {
          id,
          content: match[5].trim(),
          tags: match[3]
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
          status: file.startsWith('archive/') ? 'archived' : 'active'
        }
      if (
        !entry.content ||
        Buffer.byteLength(entry.content) > 16384 ||
        id.length > 128 ||
        entry.tags.length > 16
      ) {
        quarantine.push({ source: key, reason: 'invalid-record', sha256: digest(block) })
        continue
      }
      if (ids.has(id)) {
        quarantine.push({ source: key, reason: 'duplicate-id', sha256: digest(block) })
        const previous = ids.get(id)
        previous.invalid = true
        continue
      }
      ids.set(id, entry)
      facts.push(entry)
    }
  }
  return {
    report: {
      checksums,
      quarantine,
      accepted: facts.filter((f) => !f.invalid).length,
      sourceUnchanged: true,
      warning:
        'Markdown cannot prove original record boundaries. Review every accepted entry against the backed-up source.'
    },
    data: {
      format: 'strique-memory-facts',
      version: 1,
      scope: 'legacy-review-required',
      facts: facts.filter((f) => !f.invalid)
    }
  }
}
