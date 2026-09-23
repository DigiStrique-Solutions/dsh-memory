import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateSessionCase } from '../scripts/session-evaluation.mjs'
const entry = {
  id: 'widget',
  training: [
    {
      type: 'user/message',
      data: {
        source: { kind: 'user' },
        content: [{ type: 'text', text: 'Use check-widget after changing a widget.' }]
      }
    }
  ],
  heldOut: { input: 'How should I verify the next widget change?', expected: 'check-widget' }
}
test('end-to-end evaluation learns from training events and discovers via the real skill tool in a fresh session', async () => {
  let calls = 0
  const driver = {
    model: 'scripted-boundary',
    liveModel: false,
    async *stream(request) {
      calls++
      assert.equal(JSON.stringify(request).includes(entry.heldOut.input), false)
      const input = JSON.parse(request.messages[0].content[0].text)
      const text = JSON.stringify({
        candidates: [
          {
            package: {
              name: 'learned-widget',
              description: 'Check a widget change',
              applicability: 'Widget changes',
              content:
                '## Steps\n' +
                input.evidence[0].text +
                '\n## Verification\nRequire the check to pass.',
              resources: {}
            },
            evidence: [input.evidence[0].id]
          }
        ]
      })
      yield { type: 'text-delta', index: 0, text }
      yield { type: 'usage', usage: { totalTokens: 100 } }
      yield { type: 'finish', reason: { kind: 'stop' } }
    },
    async review(candidate) {
      return candidate.package.name === 'learned-widget'
    },
    async run(input, { execute }) {
      assert.equal(Object.hasOwn(input, 'expected'), false)
      assert.equal(Object.hasOwn(input, 'procedures'), false)
      assert.match(JSON.stringify(input.messages), /learned-widget/)
      assert.equal(JSON.stringify(input.messages).includes('Require the check to pass.'), false)
      const loaded = await execute('skill', { name: 'learned-widget' })
      assert.equal(loaded.isError, false, JSON.stringify(loaded))
      assert.match(loaded.value.content, /check-widget/)
      return { answer: 'check-widget', usage: { totalTokens: 50 } }
    }
  }
  const result = await evaluateSessionCase({ driver, entry, mode: 'learning' })
  assert.equal(calls, 1)
  assert.equal(result.success, true)
  assert.equal(result.extractionTokens, 100)
  assert.equal(result.skillLoads, 1)
  assert.equal(result.trainingFrozen, true)
})

test('held-out no-memory and factual-memory modes stay frozen and receive no oracle', async () => {
  const driver = {
    model: 'scripted-boundary',
    liveModel: false,
    async *stream(request) {
      const input = JSON.parse(request.messages[0].content[0].text)
      const e = input.evidence.find((e) => e.kind === 'user-statement')
      yield {
        type: 'text-delta',
        index: 0,
        text: JSON.stringify({
          candidates: [],
          facts: [{ content: e.text, quote: e.text, explicit: true, evidence: [e.id] }]
        })
      }
      yield { type: 'usage', usage: { totalTokens: 10 } }
      yield { type: 'finish', reason: { kind: 'stop' } }
    },
    async run(input) {
      assert.equal('expected' in input, false)
      assert.equal(
        input.tools.some((t) => t.name === 'skill'),
        false
      )
      return { answer: 'unknown', usage: { totalTokens: 10 } }
    }
  }
  for (const mode of ['none', 'memory']) {
    const result = await evaluateSessionCase({ driver, entry, mode })
    assert.equal(result.trainingFrozen, true)
    assert.equal(result.success, false)
    assert.equal(result.extractionTokens, mode === 'none' ? 0 : 10)
  }
})
