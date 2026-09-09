import { z } from 'zod'
const id = z.string().min(1).max(128)
const hash = z.string().regex(/^[a-f0-9]{64}$/)
const str = z.string().max(16384)
const time = z.number().int().nonnegative()
const ref = z.object({ id, revision: z.number().int().nonnegative() }).strict()
export const evidenceSchema = z
  .object({
    id,
    session: id,
    seq: time,
    kind: z.enum(['user-statement', 'tool-result', 'assistant-claim', 'cancellation']),
    text: str,
    hash,
    observed: time,
    successful: z.boolean(),
    revoked: z.boolean()
  })
  .strict()
const packageSchema = z
  .object({
    name: z
      .string()
      .regex(/^learned-[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(100),
    description: z.string().min(1).max(512),
    applicability: z.string().min(1).max(2048),
    content: z.string().min(1).max(32768),
    resources: z.record(z.string(), z.string().max(32768))
  })
  .strict()
export { packageSchema }
const decision = z
  .object({
    actor: z.enum(['owner', 'evaluated-policy']),
    at: time,
    reason: str,
    hash,
    base: hash.nullable()
  })
  .strict()
export const candidateSchema = z
  .object({
    id,
    hash,
    package: packageSchema,
    evidence: z.array(id).min(1).max(64),
    facts: z.array(ref).max(64),
    trust: z.enum(['user-supported', 'tool-observed', 'unverified']),
    base: hash.nullable(),
    status: z.enum([
      'proposed',
      'validated',
      'admitted',
      'active',
      'rejected',
      'superseded',
      'archived'
    ]),
    validation: z.array(z.string().max(512)).max(32),
    decision: decision.nullable(),
    created: time
  })
  .strict()
const factVersion = z
  .object({
    revision: time,
    content: str,
    tags: z.array(z.string().max(64)).max(16),
    status: z.enum(['active', 'archived', 'deleted']),
    source: z
      .object({
        kind: z.enum(['agent-proposal', 'operator', 'migration']),
        session: z.string().max(128),
        refs: z.array(id).max(64)
      })
      .strict(),
    at: time
  })
  .strict()
const fact = factVersion
  .extend({ id, history: z.array(factVersion).max(20), pinned: z.boolean() })
  .strict()
const job = z
  .object({
    id,
    session: id,
    from: time,
    to: time,
    evidence: z.array(id).max(64),
    state: z.enum(['pending', 'running', 'done', 'failed', 'paused']),
    attempts: time,
    nextAt: time,
    deadline: time,
    route: z.string().max(256),
    reservedTokens: time,
    error: z.string().max(256),
    created: time
  })
  .strict()
const publication = z
  .object({
    name: id,
    active: hash.nullable(),
    history: z.array(hash).max(20),
    candidate: id,
    receipt: decision,
    pinned: z.boolean(),
    archived: z.boolean()
  })
  .strict()
export const stateSchema = z
  .object({
    schema: z.literal(1),
    scope: id,
    root: z.string().max(4096),
    revision: time,
    facts: z.array(fact).max(2000),
    evidence: z.array(evidenceSchema).max(4000),
    candidates: z.array(candidateSchema).max(1000),
    jobs: z.array(job).max(1000),
    publications: z.array(publication).max(500),
    cursors: z.record(z.string(), time),
    targets: z.record(z.string(), time),
    receipts: z.record(
      z.string(),
      z.object({ hash, revision: time, id: z.string().max(128) }).strict()
    ),
    outcomes: z
      .array(
        z
          .object({
            id,
            name: id,
            hash,
            session: id,
            kind: z.enum(['exposure', 'success', 'failure']),
            evidence: z.array(id).max(64),
            at: time
          })
          .strict()
      )
      .max(4000),
    budget: z.object({ day: z.string(), reserved: time, used: time }).strict(),
    autonomy: z
      .object({
        enabled: z.boolean(),
        evaluation: z.string().nullable(),
        classes: z.array(z.enum(['user-supported', 'tool-observed'])).max(2)
      })
      .strict(),
    paused: z.boolean(),
    maintenance: z.array(z.object({ name: id, reason: str, at: time })).max(500)
  })
  .strict()
export function emptyState(scope, root = '') {
  return {
    schema: 1,
    scope,
    root,
    revision: 0,
    facts: [],
    evidence: [],
    candidates: [],
    jobs: [],
    publications: [],
    cursors: {},
    targets: {},
    receipts: {},
    outcomes: [],
    budget: { day: '', reserved: 0, used: 0 },
    autonomy: { enabled: false, evaluation: null, classes: [] },
    paused: false,
    maintenance: []
  }
}
