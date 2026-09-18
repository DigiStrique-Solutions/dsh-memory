import Memory, { Config, type Caller, type ProcedurePackage } from '@strique/dsh-memory'
import { toolDefinitions } from '@strique/dsh-memory/tools'
import { Config as LearningConfig, apply as learning } from '@strique/dsh-memory/learning'
import { apply as web } from '@strique/dsh-memory/web'
import type { Context } from '@deepseek-ai/cordis'
declare const ctx: Context
declare const caller: Caller
const service = new Memory(ctx, Config({}))
service.store.read(caller).facts[0]?.history
service.store.mutate(caller, {
  op: 'add',
  content: 'Fact',
  expectedRevision: 0,
  idempotencyKey: 'a'
})
const procedure: ProcedurePackage = {
  name: 'learned-check',
  description: 'Check',
  applicability: 'Project',
  content: '## Steps\nCheck\n## Verification\nPass',
  resources: {}
}
service.store.propose(caller, { package: procedure, evidence: ['source'] })
toolDefinitions(service)
learning(ctx, LearningConfig({}))
web(ctx)
