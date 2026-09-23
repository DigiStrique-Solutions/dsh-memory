#!/usr/bin/env node
import { migrationPreview } from '../lib/migration.js'
if (process.argv.length !== 3) {
  process.stderr.write('Usage: dsh-memory-migrate LEGACY_DIRECTORY > migration-preview.json\n')
  process.exit(1)
}
try {
  process.stdout.write(JSON.stringify(await migrationPreview(process.argv[2]), null, 2) + '\n')
} catch {
  process.stderr.write(
    'Migration preview failed; source is unchanged. Check path, permissions and size limits.\n'
  )
  process.exitCode = 1
}
