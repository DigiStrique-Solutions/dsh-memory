import type { Context } from '@deepseek-ai/cordis'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type StriqueMemory from './index.js'
export const name: 'strique-memory-web'
export const inject: string[]
export const ROUTE: '/strique-memory'
export function localRequest(req: IncomingMessage): boolean
export function handler(
  memory: StriqueMemory,
  connection: { requestRejection(req: IncomingMessage): number | undefined },
  lifetime?: AbortSignal
): (req: IncomingMessage, res: ServerResponse) => Promise<void>
export function apply(ctx: Context): void
