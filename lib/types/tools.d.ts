import type { Context } from '@deepseek-ai/cordis'
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import type StriqueMemory from './index.js'
export const name: 'strique-memory-tools'
export const inject: string[]
export function toolDefinitions(service: StriqueMemory): ToolDefinition[]
export function apply(ctx: Context): void
