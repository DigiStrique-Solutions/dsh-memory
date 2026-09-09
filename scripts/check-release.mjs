import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
assert.equal(pkg.name, '@strique/dsh-memory')
assert.ok(
  !Object.keys(pkg.scripts).some((k) =>
    ['preinstall', 'install', 'postinstall', 'prepare'].includes(k)
  )
)
for (const file of ['index', 'tools', 'learning', 'web']) await import('../lib/' + file + '.js')
execFileSync(process.execPath, ['--check', 'lib/client.js'], { stdio: 'inherit' })
execFileSync(
  process.execPath,
  [
    'node_modules/typescript/bin/tsc',
    '--noEmit',
    '--module',
    'nodenext',
    '--moduleResolution',
    'nodenext',
    '--target',
    'es2022',
    '--skipLibCheck',
    'test/types.ts'
  ],
  { stdio: 'inherit' }
)
const packed = JSON.parse(
  execFileSync('npm', ['pack', '--dry-run', '--ignore-scripts', '--json'], { encoding: 'utf8' })
)[0]
for (const entry of packed.files)
  assert.ok(
    !/(?:^|\/)(?:artifacts|test|node_modules|\.env|\.git|scripts)(?:\/|$)/.test(entry.path),
    entry.path
  )
for (const name of [
  'lib/index.js',
  'lib/tools.js',
  'lib/learning.js',
  'lib/client.js',
  'lib/web.js',
  'bin/dsh-memory-mcp.mjs',
  'bin/dsh-memory-migrate.mjs',
  'docs/OPERATIONS.md'
])
  assert.ok(
    packed.files.some((f) => f.path === name),
    name
  )
assert.ok(packed.unpackedSize < 512 * 1024)
for (const file of ['README.md', 'README.zh.md', 'CHANGELOG.md'])
  assert.ok(readFileSync(file, 'utf8').includes(pkg.version), file)
// The exit status is authoritative; no reporter text or frozen test count is parsed.
execFileSync('npm', ['test'], { stdio: 'inherit' })
console.log(
  'Artifact exports, syntax, file allowlist, size, documentation version and behavior checks passed.'
)
