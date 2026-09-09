import test from 'node:test'
import assert from 'node:assert/strict'
import { writeFile, mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fixture } from './helpers.js'
import { migrationPreview } from '../lib/migration.js'
test('legacy preview quarantines malformed, duplicate and secret entries without changing source', async (t) => {
  const { root } = await fixture(t)
  const block = (id, body) =>
    `### 2026-09-09T00:00:00.000Z\n**id:** ${id}\n**tags:** example\n**importance:** 1\n\n${body}\n`
  const data =
    block('safe', 'A useful fact') +
    block('duplicate', 'First') +
    block('duplicate', 'Second') +
    block('secret', 'sk-' + 'a'.repeat(32)) +
    '### malicious header\n**id:** forged\n'
  await writeFile(join(root, 'raw_memories.md'), data)
  await mkdir(join(root, 'archive'))
  await writeFile(join(root, 'archive/raw-2026-01.md'), block('archived', 'Archived fact'))
  const preview = await migrationPreview(root)
  assert.equal(preview.report.accepted, 2)
  assert.equal(preview.report.quarantine.length, 3)
  assert.equal(preview.data.facts[1].status, 'archived')
  assert.equal(await readFile(join(root, 'raw_memories.md'), 'utf8'), data)
  assert.ok(!JSON.stringify(preview).includes('sk-' + 'a'.repeat(32)))
})
