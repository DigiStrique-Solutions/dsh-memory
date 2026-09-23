import { Service, Context } from '@deepseek-ai/cordis'
import type Schema from '@deepseek-ai/schemastery'
export type ScopeKey = `project-${string}` | 'global'
export interface Caller {
  readonly principal: 'owner'
  readonly kind: 'agent' | 'operator' | 'host'
  readonly scope: ScopeKey
  readonly root?: string
  readonly session?: string
  readonly signal?: AbortSignal
}
export interface MemoryConfig {
  read: boolean
  capture: boolean
  mutate: boolean
  autoFacts: boolean
  publish: boolean
  export: boolean
  remoteEgress: boolean
  recallBytes: number
}
export interface LearningConfig {
  enabled: boolean
  provider: string
  model: string
  dailyTokens: number
  maxTokens: number
  inputBytes: number
  timeoutMs: number
}
export interface Receipt {
  id: string
  hash: string
  revision: number
}
export interface FactRevision {
  revision: number
  content: string
  tags: string[]
  status: 'active' | 'archived' | 'deleted'
  source: { kind: 'agent-proposal' | 'operator' | 'migration'; session: string; refs: string[] }
  at: number
}
export interface Fact extends FactRevision {
  id: string
  history: FactRevision[]
  pinned: boolean
}
export interface Evidence {
  id: string
  session: string
  seq: number
  kind: 'user-statement' | 'tool-result' | 'assistant-claim' | 'cancellation' | 'turn-boundary'
  text: string
  hash: string
  observed: number
  successful: boolean
  revoked: boolean
}
export interface ProcedurePackage {
  name: `learned-${string}`
  description: string
  applicability: string
  content: string
  resources: Record<string, string>
}
export interface FactProposal {
  content: string
  quote?: string
  evidence: string[]
  explicit?: boolean
  conflict?: boolean
  base?: { id: string; revision: number } | null
}
export interface FactCandidate extends FactProposal {
  id: string
  hash: string
  quote: string
  explicit: boolean
  conflict: boolean
  base: { id: string; revision: number } | null
  status: 'proposed' | 'active' | 'rejected'
  reason: string
  created: number
  factId: string | null
}
export interface FactReview extends FactCandidate {
  current: Fact | null
  sources: Evidence[]
}
export interface Candidate {
  id: string
  hash: string
  package: ProcedurePackage
  evidence: string[]
  facts: { id: string; revision: number }[]
  trust: 'user-supported' | 'tool-observed' | 'unverified'
  base: string | null
  status: 'proposed' | 'validated' | 'admitted' | 'active' | 'rejected' | 'superseded' | 'archived'
  validation: string[]
  decision: Decision | null
  created: number
}
export interface Decision {
  actor: 'owner' | 'evaluated-policy'
  at: number
  reason: string
  hash: string
  base: string | null
}
export interface Publication {
  name: string
  active: string | null
  history: string[]
  candidate: string
  receipt: Decision
  pinned: boolean
  archived: boolean
}
export interface Job {
  id: string
  session: string
  from: number
  to: number
  evidence: string[]
  state: 'pending' | 'running' | 'done' | 'failed' | 'paused'
  attempts: number
  nextAt: number
  deadline: number
  route: string
  reservedTokens: number
  reason: string
  target?: { name: string; hash: string }
  error: string
  created: number
}
export interface Mutation {
  op: 'add' | 'update' | 'delete' | 'archive' | 'restore' | 'pin'
  id?: string
  expectedRevision: number
  idempotencyKey: string
  content?: string
  tags?: string[]
  pinned?: boolean
}
export interface FactsExport {
  format: 'strique-memory-facts'
  version: 1
  scope: string
  facts: Fact[]
}
export interface ImportPreview {
  hash: string
  expectedRevision: number
  additions: number
  duplicates: string[]
  sourceChecksum: string
}
export interface MemoryAPI {
  read(
    caller: Caller,
    args?: { status?: Fact['status'] | 'all'; offset?: number; limit?: number }
  ): { scope: string; revision: number; facts: Fact[]; total: number }
  search(
    caller: Caller,
    args: { query: string; tags?: string[]; limit?: number }
  ): {
    scope: string
    matches: { id: string; revision: number; content: string; tags: string[]; score: number }[]
  }
  mutate(caller: Caller, args: Mutation): Promise<Receipt>
  recall(
    caller: Caller,
    maxBytes?: number
  ): {
    scope: string
    revision: number
    text: string
    refs: { scope: ScopeKey; id: string; revision: number }[]
  }
  capture(
    caller: Caller,
    args: {
      session: string
      events: Pick<Evidence, 'seq' | 'kind' | 'text' | 'successful'>[]
      scannedTo?: number
      targetSeq?: number
    }
  ): Promise<{ cursor: number; included: number }>
  propose(
    caller: Caller,
    args: {
      package: ProcedurePackage
      evidence: string[]
      facts?: { id: string; revision: number }[]
      base?: string | null
    }
  ): Promise<Candidate>
  proposeFact(
    caller: Caller,
    args: FactProposal
  ): Promise<FactCandidate | { status: 'duplicate'; factId: string }>
  reviewFacts(caller: Caller, args: { id: string }): { candidate: FactReview }
  reviewFacts(
    caller: Caller,
    args?: { offset?: number; limit?: number }
  ): { candidates: FactCandidate[]; total: number }
  decideFact(
    caller: Caller,
    args: { id: string; hash: string; approve: boolean; reason: string }
  ): Promise<FactCandidate>
  scheduleReview(
    caller: Caller,
    args: { session: string; through: number; reason?: string }
  ): Promise<{ scheduled: boolean }>
  maintainQueue(
    caller: Caller,
    args?: { dryRun: boolean; expectedRevision?: number }
  ): Promise<{ revision: number; retiredJobs: number; retainedJobs: number }>
  evidence(
    caller: Caller,
    args?: { session?: string; ids?: string[]; offset?: number; limit?: number }
  ): Evidence[]
  readResource(
    caller: Caller,
    args: { name: string; hash: string; path: string }
  ): Promise<{ name: string; hash: string; path: string; content: string }>
  outcomeOptions(
    caller: Caller,
    args: { name: string; hash: string; offset?: number; limit?: number }
  ): {
    total: number
    exposures: { id: string; session: string; seq: number; evidence: Evidence[] }[]
  }
  evaluationConfiguration(): Record<string, unknown>
  review(
    caller: Caller,
    args: { id: string }
  ): { candidate: Candidate; evidence: Evidence[]; publication: Publication | null }
  review(
    caller: Caller,
    args?: { offset?: number; limit?: number }
  ): { revision: number; candidates: Candidate[]; total: number; publications: Publication[] }
  validate(caller: Caller, args: { id: string; hash: string }): Promise<Candidate>
  decide(
    caller: Caller,
    args: { id: string; hash: string; base: string | null; approve: boolean; reason: string }
  ): Promise<Candidate | { candidate: Candidate; publication: Publication }>
  maintain(
    caller: Caller,
    args: {
      op: 'pin' | 'archive' | 'restore' | 'rollback'
      name: string
      expectedHash: string | null
      hash?: string
      pinned?: boolean
    }
  ): Promise<Publication | { publication: Publication; package: ProcedurePackage }>
  catalog(
    caller: Caller
  ): { name: string; description: string; hash: string; applicability: string }[]
  load(caller: Caller, name: string, hash: string): Promise<ProcedurePackage>
  export(caller: Caller): FactsExport
  import(
    caller: Caller,
    args: { data: FactsExport; dryRun?: boolean; previewHash?: string; expectedRevision?: number }
  ): Promise<ImportPreview>
  revokeEvidence(caller: Caller, id: string): Promise<{ revision: number }>
  outcome(
    caller: Caller,
    args: {
      name: string
      hash: string
      session: string
      kind: 'exposure' | 'success' | 'failure'
      seq?: number
      evidence?: string[]
    }
  ): Promise<{ id: string; kind: string }>
  pause(caller: Caller, paused: boolean): Promise<{ paused: boolean }>
  configureAutonomy(
    caller: Caller,
    args: { enabled: boolean; report?: unknown; classes?: ('user-supported' | 'tool-observed')[] }
  ): Promise<unknown>
  stats(
    caller: Caller,
    args?: { offset?: number; limit?: number }
  ): {
    scope: string
    revision: number
    facts: number
    activeFacts: number
    candidates: number
    activeSkills: number
    jobs: Omit<Job, 'evidence'>[]
    jobTotal: number
    jobCounts: Record<Job['state'], number>
    capacity: { jobs: number; evidence: number }
    oldestPendingAt: number | null
    extraction: {
      enabled: boolean
      route: { provider: string; model: string } | null
      blocked: string | null
    }
    automaticFacts: boolean
    pendingFacts: number
    evaluationConfiguration: Record<string, unknown>
    budget: { day: string; reserved: number; used: number; unknown: number }
    paused: boolean
    outcomes: number
    maintenance: unknown[]
    autonomy: {
      enabled: boolean
      effective: boolean
      evaluation: string | null
      configurationHash: string | null
      classes: string[]
    }
    captureBacklog: { session: string; from: number; to: number }[]
  }
}
export const name: 'strique-memory'
export const Config: Schema<Partial<MemoryConfig>, MemoryConfig>
export default class StriqueMemory extends Service {
  static inject: string[]
  static Config: Schema<Partial<MemoryConfig>, MemoryConfig>
  constructor(ctx: Context, config: MemoryConfig)
  readonly store: MemoryAPI
  readonly config: MemoryConfig
  fromAgent(
    agent: { session: { id: string; header: { cwd?: string } } },
    signal?: AbortSignal
  ): Caller
  fromCwd(cwd: string, signal?: AbortSignal): Caller
  reviewer(scope: ScopeKey, signal?: AbortSignal): Caller
  track<T>(promise: Promise<T> | T): Promise<T>
  dispose(): Promise<void>
}
declare module '@deepseek-ai/cordis' {
  interface Context {
    striqueMemory: StriqueMemory
  }
}
