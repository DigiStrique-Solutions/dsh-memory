// Event roles come from the durable Host envelope, never from model-generated text.
export function extractMessageText(data) {
  const message = data?.message ?? data
  return (message?.content ?? [])
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('\n')
}
export function captureEvents(events) {
  const calls = new Map(
    events.filter((e) => e.type === 'tool/call').map((e) => [e.data.callId, e.data])
  )
  return events.flatMap((event) => {
    if (event.type === 'user/message') {
      if (event.data?.source?.kind !== 'user') return []
      const text = extractMessageText(event.data)
      return text ? [{ seq: event.seq, kind: 'user-statement', text, successful: false }] : []
    }
    if (event.type === 'assistant/message') {
      if (event.data?.interrupted)
        return [
          {
            seq: event.seq,
            kind: 'cancellation',
            text: 'Assistant stream was interrupted; no success inferred',
            successful: false
          }
        ]
      const text = extractMessageText(event.data)
      return text ? [{ seq: event.seq, kind: 'assistant-claim', text, successful: false }] : []
    }
    if (event.type === 'turn/end')
      return [
        {
          seq: event.seq,
          kind: 'turn-boundary',
          text: 'Turn ended: ' + (event.data?.reason?.kind ?? 'unknown') + '; outcome unverified',
          successful: false
        }
      ]
    if (event.type === 'tool/result') {
      const block = event.data?.message?.content?.[0],
        call = calls.get(block?.toolCallId),
        name = call?.name
      if (name === 'skill' || /^(memory_|learning_)/.test(name ?? '')) return []
      const text = extractMessageText(block)
      return text
        ? [
            {
              seq: event.seq,
              kind: 'tool-result',
              text:
                (name
                  ? name +
                    ' call=' +
                    block.toolCallId +
                    ' arguments=' +
                    (typeof call.arguments === 'string'
                      ? call.arguments
                      : JSON.stringify(call.arguments ?? null))
                  : 'Missing tool call context; outcome unverified') +
                '\nResult: ' +
                text,
              successful: !!name && block.isError !== true
            }
          ]
        : []
    }
    return []
  })
}
export function resolveRoute(ctx, config) {
  if (config.provider && config.model) return { provider: config.provider, model: config.model }
  const selection = ctx.get('agentDefaultModel')?.currentSelection()
  if (selection?.provider && selection?.model) return selection
  const raw = ctx.get('settings')?.get('agent-default-model')
  if (raw?.provider && raw?.model) return { provider: raw.provider, model: raw.model }
}
