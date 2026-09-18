import type { Context } from '@deepseek-ai/cordis'
import type Schema from '@deepseek-ai/schemastery'
import type { LearningConfig } from './index.js'
export const name: 'strique-memory-learning'
export const inject: string[]
export const Config: Schema<Partial<LearningConfig>, LearningConfig>
export function apply(ctx: Context, config: LearningConfig): void
