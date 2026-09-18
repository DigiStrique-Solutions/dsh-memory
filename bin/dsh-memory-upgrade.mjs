#!/usr/bin/env node
import { upgradeSnapshot } from '../lib/upgrade.js'
import { errorResult } from '../lib/policy.js'
const [source, objects, destination, ...extra] = process.argv.slice(2)
if (!source || !objects || !destination || extra.length) {
  process.stderr.write(
    'Usage: dsh-memory-upgrade FROZEN_V1_SNAPSHOT OBJECT_DIRECTORY NEW_DESTINATION\n'
  )
  process.exitCode = 1
} else {
  try {
    process.stdout.write(
      JSON.stringify(await upgradeSnapshot({ source, objects, destination })) + '\n'
    )
  } catch (e) {
    process.stderr.write(JSON.stringify(errorResult(e)) + '\n')
    process.exitCode = 1
  }
}
