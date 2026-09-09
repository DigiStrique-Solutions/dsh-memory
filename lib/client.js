// Lazy CJS artifact consumed by DSH's Client module loader.
window.__ModuleLoader__.load({
  id: '@strique/dsh-memory',
  factory: (require) => {
    const React = require('react'),
      h = React.createElement
    const en = {
      title: 'Memory and learning',
      desc: 'Project facts and procedures with reviewed evidence.',
      scope: 'Project scope',
      global: 'Explicit global preferences',
      refresh: 'Refresh',
      loading: 'Loading…',
      empty: 'No records yet. Use memory tools in a project session to begin.',
      error: 'Operation failed',
      facts: 'Facts',
      candidates: 'Candidates',
      status: 'Jobs and budget',
      settings: 'Policy',
      review: 'Review',
      validate: 'Validate package',
      approve: 'Approve exact version',
      reject: 'Reject',
      reason: 'Decision reason',
      previous: 'Previous package',
      changes: 'Exact changes',
      validation: 'Validation results',
      proposed: 'Proposed package',
      evidence: 'Source evidence',
      close: 'Close review',
      pause: 'Pause extraction',
      resume: 'Resume extraction',
      archive: 'Archive',
      restore: 'Restore',
      rollback: 'Roll back',
      pin: 'Pin',
      unpin: 'Unpin',
      revoke: 'Revoke evidence',
      export: 'Export facts',
      import: 'Import facts JSON',
      preview: 'Preview import',
      apply: 'Apply reviewed import',
      saved: 'Saved',
      next: 'Next page',
      back: 'Previous page',
      active: 'Active procedures',
      revision: 'Revision',
      content: 'Content',
      add: 'Add explicit fact',
      update: 'Update',
      remove: 'Delete',
      notice:
        'Procedures require local human review. Model output never grants permissions. Tool completion alone does not prove task success.',
      confirmDelete: 'Delete this fact permanently?',
      resources: 'Resources are included in the reviewed package.',
      outcomes: 'Record reviewed outcome',
      success: 'Success',
      failure: 'Failure',
      session: 'Source session ID',
      evidenceIds: 'Comma-separated tool evidence IDs',
      maintenance: 'Find maintenance candidates',
      read: 'Allow recall',
      capture: 'Allow capture',
      mutate: 'Allow fact changes',
      publish: 'Allow publication',
      remoteEgress: 'Allow evidence to the configured model',
      recallBytes: 'Recall byte limit',
      savePolicy: 'Save policy',
      evaluation: 'Reviewed live-model evaluation report JSON',
      enableAutonomy: 'Enable evaluated admission',
      disableAutonomy: 'Disable unattended admission'
    }
    const zh = {
      title: '记忆与学习',
      desc: '项目事实、流程及经审核的证据。',
      scope: '项目范围',
      global: '明确的全局偏好',
      refresh: '刷新',
      loading: '加载中…',
      empty: '暂无记录。请先在项目会话中使用记忆工具。',
      error: '操作失败',
      facts: '事实',
      candidates: '候选流程',
      status: '任务与预算',
      settings: '策略',
      review: '审核',
      validate: '验证流程包',
      approve: '批准当前版本',
      reject: '拒绝',
      reason: '决定原因',
      previous: '先前流程包',
      changes: '精确更改',
      validation: '验证结果',
      proposed: '候选流程包',
      evidence: '来源证据',
      close: '关闭审核',
      pause: '暂停提取',
      resume: '恢复提取',
      archive: '归档',
      restore: '恢复',
      rollback: '回滚',
      pin: '固定',
      unpin: '取消固定',
      revoke: '撤销证据',
      export: '导出事实',
      import: '导入事实 JSON',
      preview: '预览导入',
      apply: '应用已审核的导入',
      saved: '已保存',
      next: '下一页',
      back: '上一页',
      active: '已启用流程',
      revision: '版本',
      content: '内容',
      add: '添加明确事实',
      update: '更新',
      remove: '删除',
      notice: '流程必须由本地用户审核。模型输出不会授予权限。工具完成本身不证明任务成功。',
      confirmDelete: '永久删除此事实？',
      resources: '资源包含在被审核的流程包内。',
      outcomes: '记录已审核结果',
      success: '成功',
      failure: '失败',
      session: '来源会话 ID',
      evidenceIds: '工具证据 ID，以逗号分隔',
      maintenance: '查找维护候选项',
      read: '允许读取',
      capture: '允许采集',
      mutate: '允许修改事实',
      publish: '允许发布',
      remoteEgress: '允许向配置的模型发送证据',
      recallBytes: '召回字节限制',
      savePolicy: '保存策略',
      evaluation: '已审核的真实模型评估报告 JSON',
      enableAutonomy: '启用经评估的自动批准',
      disableAutonomy: '关闭自动批准'
    }
    return {
      name: 'strique-memory-client',
      inject: ['slots', 'locale', 'connection'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register('strique-memory', { en, zh }))
        const t = ctx.locale.bind('strique-memory')
        const lifetime = new AbortController()
        ctx.effect(() => () => lifetime.abort())
        const rpc = async (method, payload, signal) => {
          const result = await ctx.connection.rpc.call(
            '/strique-memory',
            method,
            payload,
            AbortSignal.any([lifetime.signal, ...(signal ? [signal] : [])])
          )
          if (!result.ok) throw new Error(result.error.message)
          return result.value
        }
        function Card() {
          const [scope, setScope] = React.useState('global'),
            [scopes, setScopes] = React.useState([]),
            [policy, setPolicy] = React.useState({}),
            [data, setData] = React.useState(null),
            [tab, setTab] = React.useState('facts'),
            [busy, setBusy] = React.useState(false),
            [error, setError] = React.useState(''),
            [review, setReview] = React.useState(null),
            [reason, setReason] = React.useState(''),
            [offset, setOffset] = React.useState(0),
            [draft, setDraft] = React.useState(''),
            [importText, setImportText] = React.useState(''),
            [preview, setPreview] = React.useState(null),
            [outcome, setOutcome] = React.useState(null),
            [settings, setSettings] = React.useState(null),
            [evaluation, setEvaluation] = React.useState('')
          const generation = React.useRef(0),
            request = React.useRef(null)
          const componentLifetime = React.useRef(new AbortController())
          const [, refreshLocale] = React.useReducer((n) => n + 1, 0)
          React.useEffect(() => ctx.locale.subscribe(refreshLocale), [])
          React.useEffect(() => () => componentLifetime.current.abort(), [])
          const load = React.useCallback(async () => {
            const version = ++generation.current
            request.current?.abort()
            const controller = new AbortController()
            request.current = controller
            setBusy(true)
            setError('')
            try {
              const info = await rpc('scopes', {}, controller.signal)
              if (version !== generation.current) return
              setScopes(info.scopes)
              setPolicy(info)
              setSettings(info.settings)
              const next =
                tab === 'settings'
                  ? {}
                  : await rpc(
                      tab === 'facts' ? 'read' : tab === 'candidates' ? 'review' : 'stats',
                      { scope, offset, limit: 25, status: 'all' },
                      controller.signal
                    )
              if (version !== generation.current) return
              setScopes(info.scopes)
              setPolicy(info)
              setData(next)
            } catch (e) {
              if (!controller.signal.aborted) setError(e.message)
            } finally {
              if (version === generation.current) setBusy(false)
            }
          }, [scope, tab, offset])
          React.useEffect(() => {
            setReview(null)
            setPreview(null)
            setData(null)
            load()
            return () => {
              generation.current++
              request.current?.abort()
            }
          }, [load])
          const action = async (method, payload) => {
            setBusy(true)
            setError('')
            try {
              const value = await rpc(
                method,
                { scope, ...payload },
                componentLifetime.current.signal
              )
              await load()
              return value
            } catch (e) {
              setError(e.message)
              return null
            } finally {
              setBusy(false)
            }
          }
          const button = (label, onClick, disabled = false) =>
            h(
              'button',
              {
                type: 'button',
                disabled: busy || disabled,
                onClick,
                style: {
                  padding: '6px 10px',
                  margin: '3px',
                  border: '1px solid var(--color-border, #999)',
                  borderRadius: 6,
                  background: 'var(--color-bg, transparent)',
                  color: 'inherit'
                }
              },
              t(label)
            )
          const pre = (value) =>
            h(
              'pre',
              {
                style: {
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'anywhere',
                  fontSize: 12,
                  maxHeight: 420,
                  overflow: 'auto',
                  padding: 12,
                  border: '1px solid var(--color-border, #999)'
                }
              },
              typeof value === 'string' ? value : JSON.stringify(value, null, 2)
            )
          const field = (label, value, onChange, multiline = false) =>
            h(
              'label',
              { style: { display: 'block', margin: '10px 0' } },
              t(label),
              h(multiline ? 'textarea' : 'input', {
                value,
                onChange: (e) => onChange(e.target.value),
                rows: multiline ? 6 : undefined,
                style: {
                  display: 'block',
                  width: '100%',
                  boxSizing: 'border-box',
                  color: 'inherit',
                  background: 'transparent',
                  padding: 8,
                  border: '1px solid var(--color-border, #999)',
                  borderRadius: 4
                }
              })
            )
          const decide = async (approve) => {
            const c = review.candidate
            const result = await action('decide', {
              id: c.id,
              hash: c.hash,
              base: c.base,
              approve,
              reason
            })
            if (result) setReview(null)
          }
          return h(
            'section',
            {
              'aria-label': t('title'),
              style: {
                maxWidth: 1000,
                minWidth: 0,
                overflowWrap: 'anywhere',
                padding: 16,
                color: 'var(--color-text, inherit)'
              }
            },
            h('h2', null, t('title')),
            h('p', null, t('desc')),
            h('p', null, t('notice')),
            h(
              'label',
              null,
              t('scope'),
              ' ',
              h(
                'select',
                {
                  value: scope,
                  disabled: busy,
                  onChange: (e) => {
                    setScope(e.target.value)
                    setOffset(0)
                  },
                  style: { maxWidth: '100%' }
                },
                h('option', { value: 'global' }, t('global')),
                ...scopes
                  .filter((s) => s.key !== 'global')
                  .map((s) => h('option', { key: s.key, value: s.key }, s.root || s.key))
              )
            ),
            button('refresh', load),
            h(
              'nav',
              { 'aria-label': t('title') },
              ...['facts', 'candidates', 'status', 'settings'].map((key) =>
                h(
                  'button',
                  {
                    key,
                    type: 'button',
                    'aria-pressed': tab === key,
                    onClick: () => {
                      setTab(key)
                      setOffset(0)
                    },
                    style: { padding: 8, margin: 3 }
                  },
                  t(key)
                )
              )
            ),
            error && h('p', { role: 'alert' }, error),
            busy && h('p', { role: 'status' }, t('loading')),
            tab === 'settings' &&
              h(
                'fieldset',
                null,
                h('legend', null, t('settings')),
                settings &&
                  h(
                    React.Fragment,
                    null,
                    ...['read', 'capture', 'mutate', 'publish', 'export', 'remoteEgress'].map(
                      (key) =>
                        h(
                          'label',
                          { key, style: { display: 'block', padding: 6 } },
                          h('input', {
                            type: 'checkbox',
                            checked: !!settings.value[key],
                            disabled: busy || !settings.writable,
                            onChange: (e) =>
                              setSettings({
                                ...settings,
                                value: { ...settings.value, [key]: e.target.checked }
                              })
                          }),
                          ' ',
                          t(key)
                        )
                    ),
                    field('recallBytes', String(settings.value.recallBytes), (value) =>
                      setSettings({
                        ...settings,
                        value: { ...settings.value, recallBytes: Number(value) }
                      })
                    ),
                    button('savePolicy', () => action('settings', settings), !settings.writable)
                  ),
                pre({ admission: policy.admission })
              ),
            tab === 'status' &&
              data &&
              h(
                React.Fragment,
                null,
                button(data.paused ? 'resume' : 'pause', () =>
                  action('pause', { paused: !data.paused })
                ),
                button('maintenance', () => action('maintenance', {})),
                pre(data),
                field('evaluation', evaluation, setEvaluation, true),
                button(
                  'enableAutonomy',
                  async () => {
                    try {
                      await action('autonomy', {
                        enabled: true,
                        report: JSON.parse(evaluation),
                        classes: ['user-supported', 'tool-observed']
                      })
                    } catch (e) {
                      setError(e.message)
                    }
                  },
                  !evaluation.trim()
                ),
                button('disableAutonomy', () => action('autonomy', { enabled: false }))
              ),
            tab === 'facts' &&
              data &&
              h(
                React.Fragment,
                null,
                !(data.facts ?? []).length && h('p', null, t('empty')),
                ...(data.facts ?? []).map((f) =>
                  h(
                    'article',
                    {
                      key: f.id,
                      style: { padding: 12, borderBottom: '1px solid var(--color-border, #999)' }
                    },
                    h('p', null, f.content || '[' + f.status + ']'),
                    h(
                      'small',
                      null,
                      f.id + ' · ' + t('revision') + ' ' + f.revision + ' · ' + f.status
                    ),
                    f.status !== 'deleted' &&
                      h(
                        'div',
                        null,
                        button('update', () => {
                          const content = window.prompt(t('content'), f.content)
                          if (content)
                            action('mutate', {
                              op: 'update',
                              id: f.id,
                              content,
                              expectedRevision: f.revision,
                              idempotencyKey: crypto.randomUUID()
                            })
                        }),
                        button(f.status === 'archived' ? 'restore' : 'archive', () =>
                          action('mutate', {
                            op: f.status === 'archived' ? 'restore' : 'archive',
                            id: f.id,
                            expectedRevision: f.revision,
                            idempotencyKey: crypto.randomUUID()
                          })
                        ),
                        button(f.pinned ? 'unpin' : 'pin', () =>
                          action('mutate', {
                            op: 'pin',
                            pinned: !f.pinned,
                            id: f.id,
                            expectedRevision: f.revision,
                            idempotencyKey: crypto.randomUUID()
                          })
                        ),
                        button('remove', () => {
                          if (window.confirm(t('confirmDelete')))
                            action('mutate', {
                              op: 'delete',
                              id: f.id,
                              expectedRevision: f.revision,
                              idempotencyKey: crypto.randomUUID()
                            })
                        })
                      )
                  )
                ),
                field('content', draft, setDraft, true),
                button(
                  'add',
                  async () => {
                    if (
                      await action('mutate', {
                        op: 'add',
                        content: draft,
                        expectedRevision: 0,
                        idempotencyKey: crypto.randomUUID()
                      })
                    )
                      setDraft('')
                  },
                  !draft.trim()
                ),
                button('export', async () => {
                  const value = await action('export', {})
                  if (!value) return
                  const url = URL.createObjectURL(
                      new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })
                    ),
                    a = document.createElement('a')
                  a.href = url
                  a.download = 'memory-facts.json'
                  a.click()
                  setTimeout(() => URL.revokeObjectURL(url), 1000)
                }),
                field(
                  'import',
                  importText,
                  (value) => {
                    setImportText(value)
                    setPreview(null)
                  },
                  true
                ),
                button(
                  'preview',
                  async () => {
                    try {
                      setPreview(
                        await action('import', { data: JSON.parse(importText), dryRun: true })
                      )
                    } catch (e) {
                      setError(e.message)
                    }
                  },
                  !importText.trim()
                ),
                preview &&
                  h(
                    React.Fragment,
                    null,
                    pre(preview),
                    button('apply', async () => {
                      try {
                        if (
                          await action('import', {
                            data: JSON.parse(importText),
                            dryRun: false,
                            expectedRevision: preview.expectedRevision,
                            previewHash: preview.hash
                          })
                        ) {
                          setPreview(null)
                          setImportText('')
                        }
                      } catch (e) {
                        setError(e.message)
                      }
                    })
                  )
              ),
            tab === 'candidates' &&
              data &&
              h(
                React.Fragment,
                null,
                !(data.candidates ?? []).length && h('p', null, t('empty')),
                ...(data.candidates ?? []).map((c) =>
                  h(
                    'article',
                    {
                      key: c.id,
                      style: { padding: 10, borderBottom: '1px solid var(--color-border, #999)' }
                    },
                    h('strong', null, c.package.name),
                    ' · ' + c.status + ' · ' + c.trust,
                    button('review', async () => {
                      setReason('')
                      setReview(await action('review', { id: c.id }))
                    })
                  )
                ),
                h('h3', null, t('active')),
                ...(data.publications ?? []).map((p) =>
                  h(
                    'article',
                    { key: p.name },
                    h('p', null, p.name + ' · ' + (p.active ?? 'revoked')),
                    button(p.pinned ? 'unpin' : 'pin', () =>
                      action('maintain', {
                        op: 'pin',
                        name: p.name,
                        expectedHash: p.active,
                        pinned: !p.pinned
                      })
                    ),
                    button(p.archived ? 'restore' : 'archive', () =>
                      action('maintain', {
                        op: p.archived ? 'restore' : 'archive',
                        name: p.name,
                        expectedHash: p.active
                      })
                    ),
                    h(
                      'select',
                      {
                        'aria-label': t('rollback'),
                        value: '',
                        onChange: (e) => {
                          if (e.target.value)
                            action('maintain', {
                              op: 'rollback',
                              name: p.name,
                              expectedHash: p.active,
                              hash: e.target.value
                            })
                        }
                      },
                      h('option', { value: '' }, t('rollback')),
                      ...p.history.map((hash, i) =>
                        h('option', { key: hash + i, value: hash }, hash)
                      )
                    ),
                    button(
                      'outcomes',
                      () => setOutcome({ name: p.name, hash: p.active, session: '', evidence: '' }),
                      !p.active
                    )
                  )
                ),
                outcome &&
                  h(
                    'fieldset',
                    null,
                    h('legend', null, t('outcomes') + ' ' + outcome.name),
                    field('session', outcome.session, (value) =>
                      setOutcome({ ...outcome, session: value })
                    ),
                    field('evidenceIds', outcome.evidence, (value) =>
                      setOutcome({ ...outcome, evidence: value })
                    ),
                    ...['success', 'failure'].map((kind) =>
                      button(
                        kind,
                        async () => {
                          if (
                            await action('outcome', {
                              name: outcome.name,
                              hash: outcome.hash,
                              session: outcome.session,
                              evidence: outcome.evidence
                                .split(',')
                                .map((s) => s.trim())
                                .filter(Boolean),
                              kind
                            })
                          )
                            setOutcome(null)
                        },
                        !outcome.session || !outcome.evidence
                      )
                    )
                  )
              ),
            ['facts', 'candidates'].includes(tab) &&
              h(
                'div',
                null,
                button('back', () => setOffset(Math.max(0, offset - 25)), offset === 0),
                button('next', () => setOffset(offset + 25), !data || offset + 25 >= data.total)
              ),
            review &&
              h(
                'section',
                {
                  'aria-label': t('review'),
                  style: {
                    border: '2px solid var(--color-border, #999)',
                    padding: 12,
                    marginTop: 12
                  }
                },
                h('h3', null, review.candidate.package.name),
                h('p', null, review.candidate.hash),
                h('p', null, review.candidate.status + ' · ' + review.candidate.trust),
                h('h4', null, t('validation')),
                pre(review.candidate.validation),
                h('h4', null, t('changes')),
                pre(review.diff),
                h('p', null, t('resources')),
                h('h4', null, t('previous')),
                pre(review.previous),
                h('h4', null, t('proposed')),
                pre(review.candidate.package),
                h('h4', null, t('evidence')),
                ...review.evidence.map((e) =>
                  h(
                    'article',
                    { key: e.id },
                    pre(e),
                    button(
                      'revoke',
                      async () => {
                        if (await action('revoke-evidence', { id: e.id })) setReview(null)
                      },
                      e.revoked
                    )
                  )
                ),
                field('reason', reason, setReason, true),
                button(
                  'validate',
                  async () => {
                    if (
                      await action('validate', {
                        id: review.candidate.id,
                        hash: review.candidate.hash
                      })
                    )
                      setReview(await action('review', { id: review.candidate.id }))
                  },
                  !['proposed', 'validated'].includes(review.candidate.status)
                ),
                button(
                  'approve',
                  () => decide(true),
                  review.candidate.status !== 'validated' || !reason.trim()
                ),
                button(
                  'reject',
                  () => decide(false),
                  !['proposed', 'validated'].includes(review.candidate.status) || !reason.trim()
                ),
                button('close', () => setReview(null))
              )
          )
        }
        ctx.slots.inject('settings.plugin.item', () =>
          ctx.slots.register(
            {
              name: 'settings.plugin.item',
              key: 'strique-memory',
              order: 30,
              label: () => t('title')
            },
            Card
          )
        )
      }
    }
  }
})
