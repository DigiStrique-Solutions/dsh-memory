import * as SkillTool from '@deepseek-ai/dsh-tool-skill'
import { createUserMessage, createToolResultMessage } from '@deepseek-ai/dsh-llm'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
export const name = 'memory-verification-fixture'
export const inject = ['striqueMemory', 'sessions', 'tools', 'skills', 'webServer', 'connection']
export async function apply(ctx) {
  await ctx.plugin(SkillTool)
  const cwd = join(process.env.DSH_HOME, 'verification-project')
  await mkdir(join(cwd, '.git'), { recursive: true })
  const session = ctx.sessions.create('memory-browser-training', { meta: { cwd } }),
    caller = { ...ctx.striqueMemory.fromAgent({ session }), kind: 'host' }
  session.append(
    'user/message',
    createUserMessage({
      content: [
        { type: 'text', text: 'For this fixture, run check-widget after changing a widget.' }
      ],
      source: { kind: 'user' }
    }),
    { surfaceOp: 'append' }
  )
  session.append('tool/call', {
    callId: 'fixture-widget-check',
    name: 'check_widget',
    arguments: '{}',
    turn: 1,
    step: 1
  })
  session.append(
    'tool/result',
    {
      turn: 1,
      step: 1,
      message: createToolResultMessage({
        callId: 'fixture-widget-check',
        content: [{ type: 'text', text: 'check-widget: all 4 assertions pass, exit 0' }],
        isError: false
      })
    },
    { surfaceOp: 'append' }
  )
  await ctx.sessions.flush(session)
  const packageValue = {
    name: 'learned-browser-widget-check',
    description: 'Validate widget changes in the isolated fixture',
    applicability: 'Only the isolated verification project',
    content:
      '## Steps\nRun check-widget after changing a widget.\n\n## Verification\nAll 4 assertions must pass with exit status 0.',
    resources: { 'references/widget.md': 'Four assertions verify the widget output.' }
  }
  await ctx.striqueMemory.store.propose(caller, {
    package: packageValue,
    evidence: ctx.striqueMemory.store.evidence(caller).map((e) => e.id),
    base:
      ctx.striqueMemory.store.state(caller).publications.find((p) => p.name === packageValue.name)
        ?.active ?? null
  })
  await ctx.striqueMemory.store.proposeFact(caller, {
    content: 'For this fixture, run check-widget after changing a widget.',
    explicit: true,
    evidence: ctx.striqueMemory.store
      .evidence(caller)
      .filter((e) => e.kind === 'user-statement')
      .slice(-1)
      .map((e) => e.id)
  })
  await ctx.striqueMemory.store.proposeFact(caller, {
    content: 'Use check-widget with verbose output.',
    quote: 'For this fixture, run check-widget after changing a widget.',
    explicit: false,
    evidence: ctx.striqueMemory.store
      .evidence(caller)
      .filter((e) => e.kind === 'user-statement')
      .map((e) => e.id)
  })
  const fresh = ctx.sessions.create('memory-browser-fresh', { meta: { cwd } })
  ctx.effect(() =>
    ctx.webServer.register({
      kind: 'exact',
      path: '/memory-verification',
      async handler(req, res) {
        const denied = ctx.connection.requestRejection(req)
        if (denied !== undefined) {
          res.writeHead(denied)
          res.end()
          return
        }
        if (req.method === 'POST' && req.url.includes('use')) {
          const agent = { id: fresh.id, ctx, session: fresh }
          const callId = 'use-' + Date.now()
          fresh.append('tool/call', {
            callId,
            name: 'skill',
            arguments: JSON.stringify({ name: packageValue.name }),
            turn: 1,
            step: 1
          })
          const result = await ctx.tools.execute({
            name: 'skill',
            callId,
            arguments: { name: packageValue.name },
            agent,
            signal: AbortSignal.timeout(5000)
          })
          if (result.isError) throw new Error('Fixture skill load failed')
          fresh.append('tool/call', {
            callId: callId + '-verify',
            name: 'check_widget',
            arguments: '{}',
            turn: 1,
            step: 2
          })
          fresh.append(
            'tool/result',
            {
              turn: 1,
              step: 2,
              message: createToolResultMessage({
                callId: callId + '-verify',
                content: [{ type: 'text', text: 'Widget check: 4 assertions pass' }],
                isError: false
              })
            },
            { surfaceOp: 'append' }
          )
          await ctx.sessions.flush(fresh)
          await ctx.striqueMemory.store.tail
          res.writeHead(200, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ ok: true }))
          return
        }
        if (req.method === 'POST' && req.url.includes('fact')) {
          const proposal = await ctx.striqueMemory.store.proposeFact(caller, {
            content: 'Use check-widget with verbose output. Review ' + Date.now(),
            quote: 'For this fixture, run check-widget after changing a widget.',
            explicit: false,
            evidence: ctx.striqueMemory.store
              .evidence(caller)
              .filter((e) => e.kind === 'user-statement')
              .slice(-1)
              .map((e) => e.id)
          })
          res.writeHead(200, { 'content-type': 'application/json' })
          res.end(JSON.stringify(proposal))
          return
        }
        if (req.method === 'POST') {
          const current = ctx.striqueMemory.store
            .state(caller)
            .publications.find((p) => p.name === packageValue.name)
          const proposal = await ctx.striqueMemory.store.propose(caller, {
            package: {
              ...packageValue,
              content: packageValue.content + '\n\nReview fixture revision ' + Date.now()
            },
            evidence: ctx.striqueMemory.store.evidence(caller).map((e) => e.id),
            base: current?.active ?? null
          })
          res.writeHead(200, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ id: proposal.id }))
          return
        }
        const catalog = await ctx.skills.list({ cwd, scope: { session: fresh } })
        const loaded = await ctx.skills.get(packageValue.name, { cwd, scope: { session: fresh } })
        res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' })
        res.end(
          JSON.stringify({
            freshSession: fresh.id,
            catalog: catalog.filter((p) => p.name === packageValue.name),
            loaded: loaded ?? null
          })
        )
      }
    })
  )
  await writeFile(
    join(process.env.DSH_HOME, 'fixture-ready.json'),
    JSON.stringify({ scope: caller.scope, cwd, name: packageValue.name })
  )
}
export const verificationVersion = 1
