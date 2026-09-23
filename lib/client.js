// Lazy CJS artifact consumed by DSH's Client module loader.
window.__ModuleLoader__.load({
  id: '@strique/dsh-memory',
  factory: (require) => {
    const React = require('react'),
      h = React.createElement
    const en = {
      title: 'Memory and learning',
      desc: 'What your assistant remembers, and what it learns from experience.',
      scope: 'Project scope',
      global: 'Global preferences',
      refresh: 'Refresh',
      loading: 'Loading…',
      empty: 'No records yet. Use memory tools in a project session to begin.',
      error: 'Operation failed',
      facts: 'Saved facts',
      navigation: 'Memory',
      backToChat: 'Back to chat',
      saveFact: 'Save fact',
      cancel: 'Cancel',
      deleteFact: 'Delete fact',
      transfer: 'Import and export',
      advanced: 'Advanced controls',
      technical: 'Technical details',
      activity: 'Learning activity',
      activityDesc: 'See what is running, what needs attention, and how much learning has used.',
      factsDesc: 'Facts and preferences available to future conversations in this scope.',
      factReviewDesc: 'Check inferred facts and conflicting changes before they are saved.',
      candidatesDesc: 'Review new procedures and manage the ones your assistant can use.',
      settingsDesc: 'Control how memory is captured, recalled, and shared with your model.',
      noFacts: 'No saved facts yet',
      noFactsDesc: 'Add a fact below, or share an explicit preference in a project conversation.',
      noReviews: 'No facts to review',
      noReviewsDesc: 'Inferred facts and conflicting changes will appear here.',
      noProcedures: 'No procedure proposals',
      noProceduresDesc: 'New lessons will appear here for review before they become available.',
      noActive: 'No active procedures yet.',
      noJobs: 'No recent extraction jobs.',
      on: 'On',
      off: 'Off',
      needsReview: 'Human review',
      evaluated: 'Evaluated admission',
      paused: 'Paused',
      running: 'Ready',
      blockedStatus: 'Needs attention',
      pending: 'Waiting',
      failed: 'Failed',
      completed: 'Completed',
      tokens: 'Tokens used',
      reserved: 'Reserved tokens',
      jobs: 'Recent jobs',
      budgetDetails: 'Budget details',
      sourceDetails: 'Source details',
      reviewSteps:
        'Read the procedure and its sources, validate the package, then record your decision.',
      pinned: 'Pinned',
      page: 'Page',
      factSaved: 'Fact saved',
      decisionSaved: 'Decision saved',
      changesSaved: 'Changes saved',
      deleteHint: 'This removes the saved fact. This action cannot be undone.',
      remoteHint:
        'Extraction is blocked because sending evidence to the configured model is disabled. Enable it in Settings to allow extraction.',
      permissionsHint: 'These controls apply across all project scopes.',
      readHint: 'Use saved knowledge in future conversations.',
      captureHint: 'Keep conversation evidence for memory and learning.',
      mutateHint: 'Allow saved facts to be added or changed.',
      autoFactsHint:
        'Save clear user statements automatically. Inferences and conflicts still need review.',
      publishHint: 'Allow reviewed procedures to become available as skills.',
      exportHint: 'Allow facts to be downloaded.',
      remoteEgressHint: 'Send captured evidence to the configured extraction model.',
      factReview: 'Fact review',
      currentFact: 'Current fact',
      statement: 'Original statement',
      autoFacts: 'Automatically save explicit non-conflicting facts',
      extraction: 'Extraction',
      blocked: 'Block reason',
      route: 'Effective model route',
      queue: 'Queue summary',
      usage: 'Usage and reservations',
      admission: 'Procedure admission',
      pendingFacts: 'Pending fact reviews',
      exposure: 'Skill use in a session',
      maintenancePreview: 'Preview backlog maintenance',
      compact: 'Apply reviewed compaction',
      candidates: 'Procedures',
      status: 'Activity',
      settings: 'Settings',
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
      navigation: '记忆',
      backToChat: '返回聊天',
      saveFact: '保存事实',
      cancel: '取消',
      deleteFact: '删除事实',
      transfer: '导入与导出',
      advanced: '高级控制',
      technical: '技术详情',
      activity: '学习活动',
      activityDesc: '查看任务状态、待处理事项和学习用量。',
      factsDesc: '此范围内可供后续会话使用的事实与偏好。',
      factReviewDesc: '保存前审核推断的事实与冲突变更。',
      candidatesDesc: '审核新流程并管理助手可使用的流程。',
      settingsDesc: '控制记忆的采集、读取和模型共享。',
      noFacts: '暂无已保存的事实',
      noFactsDesc: '在下方添加事实，或在项目会话中明确表达偏好。',
      noReviews: '暂无待审核事实',
      noReviewsDesc: '推断的事实与冲突变更将在此显示。',
      noProcedures: '暂无候选流程',
      noProceduresDesc: '新的经验将在此接受审核后启用。',
      noActive: '暂无已启用流程。',
      noJobs: '暂无近期提取任务。',
      on: '已开启',
      off: '已关闭',
      needsReview: '人工审核',
      evaluated: '经评估的批准',
      paused: '已暂停',
      running: '就绪',
      blockedStatus: '需要处理',
      pending: '等待中',
      failed: '失败',
      completed: '已完成',
      tokens: '已用令牌',
      reserved: '预留令牌',
      jobs: '近期任务',
      budgetDetails: '预算详情',
      sourceDetails: '来源详情',
      reviewSteps: '阅读流程与来源，验证流程包，然后记录决定。',
      pinned: '已固定',
      page: '页',
      factSaved: '事实已保存',
      decisionSaved: '决定已保存',
      changesSaved: '变更已保存',
      deleteHint: '这将移除已保存的事实，且无法撤销。',
      remoteHint: '尚未允许向配置的模型发送证据，因此提取被阻止。可在设置中开启。',
      permissionsHint: '这些设置适用于所有项目范围。',
      readHint: '在后续会话中使用已保存的知识。',
      captureHint: '保留用于记忆与学习的会话证据。',
      mutateHint: '允许添加或修改已保存的事实。',
      autoFactsHint: '自动保存明确的用户陈述；推断和冲突仍需审核。',
      publishHint: '允许已审核流程作为技能使用。',
      exportHint: '允许下载事实。',
      remoteEgressHint: '向配置的提取模型发送采集的证据。',
      factReview: '事实审核',
      currentFact: '当前事实',
      statement: '原始陈述',
      autoFacts: '自动保存明确且无冲突的事实',
      extraction: '提取',
      blocked: '阻止原因',
      route: '实际模型路由',
      queue: '队列摘要',
      usage: '用量与预留',
      admission: '流程批准',
      pendingFacts: '待审核事实',
      exposure: '会话中的流程使用',
      maintenancePreview: '预览队列维护',
      compact: '应用已审核的清理',
      candidates: '流程',
      status: '活动',
      settings: '设置',
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
    const paths = {
      memory:
        'M8 4H6a2 2 0 0 0-2 2v2m12-4h2a2 2 0 0 1 2 2v2M4 16v2a2 2 0 0 0 2 2h2m8 0h2a2 2 0 0 0 2-2v-2M8 8h8v8H8z',
      pin: 'M9 3h6l-1 7 4 4v2H6v-2l4-4-1-7ZM12 16v5',
      unpin: 'M9 3h6l-1 7 4 4v2H9m3 0v5M3 3l18 18',
      update: 'm16 3 5 5-12 12-6 1 1-6L16 3Zm-2 2 5 5',
      archive: 'M3 3h18v4H3zM5 7v14h14V7M9 11h6',
      restore: 'M3 3h18v4H3zM5 7v14h14V7m-7 10v-7m-3 3 3-3 3 3',
      remove: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
      refresh: 'M20 7a8 8 0 1 0 0 10M20 3v5h-5',
      back: 'm14 6-6 6 6 6',
      next: 'm10 6 6 6-6 6',
      backToChat: 'M20 12H4m6-6-6 6 6 6'
    }
    const icon = (name, size = 17) =>
      h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.7,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          focusable: false
        },
        h('path', { d: paths[name] })
      )
    const styles = `
.sm-page { height:100%; min-height:0; min-width:0; overflow:auto; box-sizing:border-box; padding:24px 32px; background:var(--dsw-alias-bg-base,#fff) }
.sm-heading-copy { flex:1; min-width:0 }
.sm-head > .sm-btn { flex-shrink:0 }
.sm-memory { max-width:960px; margin:0 auto }
.sm-icon-button { position:relative; display:inline-flex; align-items:center; justify-content:center; width:34px; padding:6px!important; vertical-align:middle }
.sm-icon-button[aria-pressed=true] { background:var(--sm-surface); color:var(--sm-accent); border-color:var(--sm-accent) }
.sm-icon-button::after { content:attr(data-tooltip); position:absolute; top:calc(100% + 6px); left:0; z-index:5; pointer-events:none; width:max-content; max-width:180px; white-space:normal; border:1px solid var(--sm-border); border-radius:6px; padding:5px 8px; font-size:11px; background:var(--sm-bg); color:var(--dsw-alias-label-primary,#16181d); box-shadow:0 3px 12px #0002; opacity:0 }
.sm-icon-button:hover::after,.sm-icon-button:focus-visible::after { opacity:1 }
.sm-memory {
  padding-top: 26px;
}
.sm-workspace-dialog .sm-head {
  position: sticky;
  top: 0;
  background: var(--sm-bg);
  padding: 12px 0;
  z-index: 1;
}
.sm-memory {
  --sm-border: var(--dsw-alias-border-l2, #e3e5e9);
  --sm-muted: var(--dsw-alias-label-secondary, #6b7280);
  --sm-bg: var(--dsw-alias-bg-base, #fff);
  --sm-surface: color-mix(
    in srgb,
    var(--dsw-alias-label-primary, #16181d) 4%,
    var(--dsw-alias-bg-base, #fff)
  );
  --sm-accent: var(--dsw-alias-brand-primary, #4d6bfe);
  color: var(--dsw-alias-label-primary, #16181d);
  font-size: 13px;
  line-height: 1.55;
  min-width: 0;
  width: 100%;
  container-type: inline-size;
  padding: 16px 0 24px;
  overflow-wrap: anywhere;
}
.sm-memory * {
  box-sizing: border-box;
}
.sm-memory h2,
.sm-memory h3,
.sm-memory h4,
.sm-memory p {
  margin: 0;
}
.sm-memory h2 {
  font-size: 21px;
  letter-spacing: -0.5px;
  font-weight: 650;
}
.sm-memory h3 {
  font-size: 15px;
  font-weight: 600;
}
.sm-memory h4 {
  font-size: 12px;
  margin: 16px 0 8px;
  color: var(--sm-muted);
}
.sm-memory p {
  margin: 6px 0 12px;
}
.sm-muted,
.sm-memory small {
  color: var(--sm-muted);
}
.sm-head {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 20px;
}
.sm-symbol {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 12px;
  background: var(--sm-surface);
  color: var(--sm-accent);
}
.sm-head p {
  margin: 3px 0 0;
  font-size: 12px;
  color: var(--sm-muted);
}
.sm-toolbar {
  display: flex;
  align-items: end;
  gap: 8px;
  margin-bottom: 18px;
}
.sm-toolbar label {
  flex: 1;
  min-width: 0;
  font-size: 11px;
  font-weight: 600;
  color: var(--sm-muted);
}
.sm-memory select,
.sm-memory input:not([type="checkbox"]),
.sm-memory textarea {
  font: inherit;
  color: inherit;
  background: var(--sm-bg);
  border: 1px solid var(--sm-border);
  border-radius: 8px;
  padding: 9px 11px;
  min-width: 0;
  max-width: 100%;
  width: 100%;
}
.sm-memory select {
  margin-top: 5px;
  text-overflow: ellipsis;
}
.sm-memory textarea {
  resize: vertical;
  min-height: 90px;
}
.sm-field {
  display: block;
  margin: 14px 0;
  font-size: 12px;
  font-weight: 500;
}
.sm-field input,
.sm-field textarea {
  display: block;
  margin-top: 6px;
  font-weight: 400;
}
.sm-memory button {
  font: inherit;
  cursor: pointer;
}
.sm-btn {
  min-height: 34px;
  padding: 6px 12px;
  margin: 4px 6px 4px 0;
  border: 1px solid var(--sm-border);
  border-radius: 8px;
  background: transparent;
  color: inherit;
  font-size: 12px !important;
  font-weight: 500;
}
.sm-btn:hover:not(:disabled) {
  background: var(--sm-surface);
}
.sm-btn.primary {
  background: var(--dsw-alias-button-primary-fill, #20232a);
  color: var(--dsw-alias-label-primary-foreground, #fff);
  border-color: transparent;
}
.sm-btn.primary:hover:not(:disabled) {
  background: var(--dsw-alias-button-primary-hover, #353a45);
}
.sm-btn.danger {
  color: var(--dsw-alias-label-error, #b42318);
}
.sm-memory button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.sm-memory :is(button, input, textarea, select, summary):focus-visible {
  outline: 2px solid var(--sm-accent);
  outline-offset: 3px;
}
.sm-tabs {
  display: flex;
  gap: 2px;
  border-bottom: 1px solid var(--sm-border);
  margin-bottom: 22px;
  overflow-x: auto;
}
.sm-tabs button {
  flex: 1;
  white-space: nowrap;
  border: 0;
  border-bottom: 2px solid transparent;
  padding: 10px 7px;
  background: transparent;
  color: var(--sm-muted);
  font-size: 12px;
}
.sm-tabs button[aria-pressed="true"] {
  color: var(--dsw-alias-label-primary, #16181d);
  border-bottom-color: var(--sm-accent);
  font-weight: 600;
}
.sm-tabs button:hover {
  background: var(--sm-surface);
}
.sm-section-head {
  margin-bottom: 16px;
}
.sm-section-head p {
  font-size: 12px;
  color: var(--sm-muted);
}
.sm-memory article {
  padding: 16px;
  border: 1px solid var(--sm-border);
  border-radius: 10px;
  margin: 10px 0;
  background: var(--sm-bg);
}
.sm-memory article > p:first-child {
  font-size: 14px;
  line-height: 1.65;
  margin-top: 0;
}
.sm-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin: 8px 0;
  color: var(--sm-muted);
  font-size: 11px;
}
.sm-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 6px;
  background: var(--sm-surface);
  font-size: 11px;
  font-weight: 500;
  max-width: 100%;
}
.sm-memory details {
  border: 1px solid var(--sm-border);
  border-radius: 9px;
  margin: 14px 0;
  padding: 0 12px;
}
.sm-memory summary {
  cursor: pointer;
  padding: 11px 0;
  font-size: 12px;
  font-weight: 550;
  color: var(--sm-muted);
}
.sm-memory details[open] > summary {
  margin-bottom: 8px;
}
.sm-memory details > :last-child:not(summary) {
  margin-bottom: 12px;
}
.sm-memory pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font:
    11px/1.6 ui-monospace,
    monospace;
  max-height: 320px;
  overflow: auto;
  background: var(--sm-surface);
  border-radius: 8px;
  padding: 12px;
  margin: 8px 0;
  color: inherit;
}
.sm-empty {
  text-align: center;
  padding: 28px 20px;
  margin: 14px 0 18px;
  background: var(--sm-surface);
  border: 1px dashed var(--sm-border);
  border-radius: 12px;
}
.sm-empty p {
  font-size: 12px;
  color: var(--sm-muted);
  max-width: 330px;
  margin: 6px auto 0;
}
.sm-empty-mark {
  font-size: 23px;
  color: var(--sm-muted);
  margin-bottom: 8px;
}
.sm-editor {
  padding: 14px;
  border: 1px solid var(--sm-border);
  border-radius: 10px;
  background: var(--sm-surface);
  margin: 12px 0;
}
.sm-editor .sm-field {
  margin-top: 0;
}
.sm-alert {
  padding: 12px 14px;
  border: 1px solid var(--sm-border);
  border-left: 3px solid var(--sm-accent);
  border-radius: 8px;
  background: var(--sm-surface);
  font-size: 12px;
  margin: 12px 0;
}
.sm-alert.error {
  border-left-color: #d92d20;
}
.sm-notice {
  font-size: 11px;
  color: var(--sm-muted);
  margin: 16px 0;
}
.sm-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin: 16px 0;
}
.sm-stat {
  padding: 12px;
  background: var(--sm-surface);
  border-radius: 10px;
}
.sm-stat strong {
  display: block;
  font-size: 22px;
  line-height: 1.4;
  letter-spacing: -0.5px;
}
.sm-stat span {
  font-size: 11px;
  color: var(--sm-muted);
}
.sm-memory dl {
  margin: 14px 0;
  display: grid;
  grid-template-columns: minmax(100px, 1fr) minmax(0, 1.4fr);
  gap: 10px 16px;
  font-size: 12px;
}
.sm-memory dt {
  color: var(--sm-muted);
}
.sm-memory dd {
  margin: 0;
  text-align: right;
}
.sm-memory fieldset {
  min-width: 0;
  border: 1px solid var(--sm-border);
  border-radius: 10px;
  padding: 16px;
  margin: 14px 0;
}
.sm-memory legend {
  font-weight: 600;
  padding: 0 5px;
}
.sm-policy-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 13px 0;
  border-bottom: 1px solid var(--sm-border);
  cursor: pointer;
}
.sm-policy-row input {
  accent-color: var(--sm-accent);
  width: 17px;
  height: 17px;
  flex-shrink: 0;
}
.sm-policy-row span {
  font-weight: 500;
}
.sm-policy-row small {
  display: block;
  font-weight: 400;
  font-size: 11px;
  margin-top: 2px;
}
.sm-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border-top: 1px solid var(--sm-border);
  margin-top: 20px;
  padding-top: 12px;
  font-size: 11px;
  color: var(--sm-muted);
}
.sm-review:focus {
  outline: none;
}
.sm-review-body {
  padding: 16px;
  background: var(--sm-surface);
  border-radius: 10px;
  white-space: pre-wrap;
  font-size: 13px;
  line-height: 1.7;
}
.sm-review-actions {
  border-top: 1px solid var(--sm-border);
  margin-top: 20px;
  padding-top: 4px;
}
.sm-resource {
  margin: 12px 0;
}
.sm-row-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.sm-inline-message {
  color: var(--sm-muted);
  font-size: 12px;
  margin: 10px 0;
}
@media(max-width:600px) { .sm-page { padding:16px 12px } }
@container (max-width:420px) {
  .sm-head {
    flex-wrap: wrap;
  }

  .sm-heading-copy {
    flex-basis: calc(100% - 96px);
  }
  .sm-head {
    align-items: start;
  }
  .sm-head h2 {
    font-size: 19px;
  }
  .sm-symbol {
    width: 34px;
    height: 34px;
  }
  .sm-tabs {
    flex-wrap: wrap;
    overflow: visible;
  }
  .sm-tabs button {
    flex: 1 0 28%;
    padding: 9px 5px;
  }
  .sm-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .sm-memory article {
    padding: 12px;
  }
  .sm-memory dl {
    grid-template-columns: 1fr;
  }
  .sm-memory dd {
    text-align: left;
  }
  .sm-toolbar {
    flex-wrap: wrap;
  }
  .sm-toolbar label {
    flex-basis: 75%;
  }
}
`
    return {
      name: 'strique-memory-client',
      inject: ['slots', 'locale', 'connection', 'layout'],
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
          if (!result.ok) throw new Error(result.error.code + ': ' + result.error.message)
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
            [evaluation, setEvaluation] = React.useState(''),
            [factReasons, setFactReasons] = React.useState({}),
            [factDetails, setFactDetails] = React.useState(null),
            [maintenancePreview, setMaintenancePreview] = React.useState(null),
            [editing, setEditing] = React.useState(null),
            [deleting, setDeleting] = React.useState(null),
            [adding, setAdding] = React.useState(false),
            [message, setMessage] = React.useState('')
          const generation = React.useRef(0),
            request = React.useRef(null),
            reviewPanel = React.useRef(null),
            reviewTrigger = React.useRef(null),
            cardRef = React.useRef(null)
          const componentLifetime = React.useRef(new AbortController())
          const [, refreshLocale] = React.useReducer((n) => n + 1, 0)
          React.useEffect(() => ctx.locale.subscribe(refreshLocale), [])
          React.useEffect(() => () => componentLifetime.current.abort(), [])
          React.useEffect(() => {
            if (review) reviewPanel.current?.focus()
          }, [review?.candidate.id])
          const closeReview = () => {
            setReview(null)
            requestAnimationFrame(() => {
              const target = cardRef.current?.querySelector(
                '[data-candidate-id="' + reviewTrigger.current + '"] button'
              )
              target?.focus()
            })
          }
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
                      tab === 'facts'
                        ? 'read'
                        : tab === 'factReview'
                          ? 'fact-review'
                          : tab === 'candidates'
                            ? 'review'
                            : 'stats',
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
            setOutcome(null)
            setFactReasons({})
            setFactDetails(null)
            setMaintenancePreview(null)
            setDraft('')
            setEditing(null)
            setDeleting(null)
            setAdding(false)
            setMessage('')
            setImportText('')
            setData(null)
            load()
            return () => {
              generation.current++
              request.current?.abort()
            }
          }, [load])
          const action = async (method, payload) => {
            const version = generation.current
            setBusy(true)
            setError('')
            try {
              const value = await rpc(
                method,
                { scope, ...payload },
                componentLifetime.current.signal
              )
              if (version !== generation.current) return null
              await load()
              if (
                ![
                  'review',
                  'fact-review',
                  'validate',
                  'outcome-options',
                  'export',
                  'queue-maintenance'
                ].includes(method)
              )
                setMessage(
                  t(
                    method === 'mutate'
                      ? 'factSaved'
                      : method.includes('decide')
                        ? 'decisionSaved'
                        : 'changesSaved'
                  )
                )
              return value
            } catch (e) {
              if (version === generation.current) setError(e.message)
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
                'aria-label': t(label),
                title: paths[label] ? t(label) : undefined,
                'data-tooltip': paths[label] ? t(label) : undefined,
                'aria-pressed': ['pin', 'unpin'].includes(label) ? label === 'unpin' : undefined,
                className:
                  'sm-btn' +
                  (paths[label] ? ' sm-icon-button' : '') +
                  (['add', 'saveFact', 'approve', 'savePolicy', 'apply'].includes(label)
                    ? ' primary'
                    : ['remove', 'deleteFact', 'reject', 'revoke'].includes(label)
                      ? ' danger'
                      : '')
              },
              paths[label] ? icon(label) : t(label)
            )
          const pre = (value) =>
            h('pre', null, typeof value === 'string' ? value : JSON.stringify(value, null, 2))
          const details = (label, ...children) =>
            h('details', null, h('summary', null, t(label)), ...children)
          const badge = (value) => h('span', { className: 'sm-badge' }, value)
          const empty = (title, desc) =>
            h(
              'div',
              { className: 'sm-empty' },
              h('div', { className: 'sm-empty-mark', 'aria-hidden': true }, '◇'),
              h('h3', null, t(title)),
              h('p', null, t(desc))
            )
          const stat = (label, value) =>
            h(
              'div',
              { className: 'sm-stat' },
              h('strong', null, value ?? 'Unknown'),
              h('span', null, t(label))
            )
          const field = (label, value, onChange, multiline = false, autoFocus = false) =>
            h(
              'label',
              { className: 'sm-field' },
              t(label),
              h(multiline ? 'textarea' : 'input', {
                value,
                onChange: (e) => onChange(e.target.value),
                rows: multiline ? 3 : undefined,
                autoFocus
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
            if (result) closeReview()
          }
          const content = h(
            'section',
            {
              'aria-label': t('title'),
              className: 'sm-memory',
              ref: cardRef
            },
            h('style', null, styles),
            h(
              'header',
              { className: 'sm-head' },
              h(
                'div',
                { className: 'sm-symbol', 'aria-hidden': true },
                h(
                  'svg',
                  {
                    width: 22,
                    height: 22,
                    viewBox: '0 0 24 24',
                    fill: 'none',
                    stroke: 'currentColor',
                    strokeWidth: 1.6
                  },
                  h('path', {
                    d: 'M8 4H6a2 2 0 0 0-2 2v2m12-4h2a2 2 0 0 1 2 2v2M4 16v2a2 2 0 0 0 2 2h2m8 0h2a2 2 0 0 0 2-2v-2M8 8h8v8H8z'
                  })
                )
              ),
              h(
                'div',
                { className: 'sm-heading-copy' },
                h('h2', null, t('title')),
                h('p', null, t('desc'))
              ),
              button('backToChat', () => ctx.layout.selectPanel(null))
            ),
            h(
              'div',
              { className: 'sm-toolbar' },
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
                      setData(null)
                      setScope(e.target.value)
                      setOffset(0)
                    },
                    title: scopes.find((s) => s.key === scope)?.root || t('global')
                  },
                  h('option', { value: 'global' }, t('global')),
                  ...scopes
                    .filter((s) => s.key !== 'global')
                    .map((s) =>
                      h(
                        'option',
                        { key: s.key, value: s.key },
                        s.root ? s.root.split(/[\\/]/).filter(Boolean).slice(-2).join('/') : s.key
                      )
                    )
                )
              ),
              button('refresh', load)
            ),
            h(
              'nav',
              { 'aria-label': t('title'), className: 'sm-tabs' },
              ...['facts', 'factReview', 'candidates', 'status', 'settings'].map((key) =>
                h(
                  'button',
                  {
                    key,
                    type: 'button',
                    'aria-pressed': tab === key,
                    disabled: busy,
                    onClick: () => {
                      if (key === tab) {
                        if (review) closeReview()
                        return
                      }
                      setData(null)
                      setTab(key)
                      setOffset(0)
                    },
                    onKeyDown: (e) => {
                      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                        e.preventDefault()
                        const buttons = [...e.currentTarget.parentElement.children]
                        buttons[
                          (buttons.indexOf(e.currentTarget) +
                            (e.key === 'ArrowRight' ? 1 : buttons.length - 1)) %
                            buttons.length
                        ].focus()
                      }
                    }
                  },
                  t(key)
                )
              )
            ),
            error && h('div', { role: 'alert', className: 'sm-alert error' }, error),
            h('div', { 'aria-live': 'polite', className: 'sm-inline-message' }, message),
            !review &&
              h(
                'div',
                { className: 'sm-section-head' },
                h('h3', null, t(tab === 'status' ? 'activity' : tab)),
                h('p', null, t(tab === 'status' ? 'activityDesc' : tab + 'Desc'))
              ),
            busy && h('p', { role: 'status' }, t('loading')),
            !review &&
              tab === 'settings' &&
              h(
                'fieldset',
                null,
                h('legend', null, t('settings')),
                h('p', { className: 'sm-muted' }, t('permissionsHint')),
                settings &&
                  h(
                    React.Fragment,
                    null,
                    ...[
                      'read',
                      'capture',
                      'mutate',
                      'autoFacts',
                      'publish',
                      'export',
                      'remoteEgress'
                    ].map((key) =>
                      h(
                        'label',
                        { key, className: 'sm-policy-row' },
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
                        h('span', null, t(key), h('small', null, t(key + 'Hint')))
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
                h('p', { className: 'sm-notice' }, t('notice'))
              ),
            !review &&
              tab === 'status' &&
              data &&
              h(
                React.Fragment,
                null,
                button(data.paused ? 'resume' : 'pause', () =>
                  action('pause', { paused: !data.paused })
                ),

                h(
                  'dl',
                  null,
                  h('dt', null, t('capture')),
                  h('dd', null, badge(t(policy.policy?.capture ? 'on' : 'off'))),
                  h('dt', null, t('extraction')),
                  h(
                    'dd',
                    null,
                    badge(
                      t(
                        data.paused
                          ? 'paused'
                          : data.extraction?.blocked
                            ? 'blockedStatus'
                            : data.extraction?.enabled
                              ? 'running'
                              : 'off'
                      )
                    )
                  ),
                  h('dt', null, t('blocked')),
                  h('dd', null, data.extraction?.blocked ?? 'none'),
                  h('dt', null, t('route')),
                  h(
                    'dd',
                    null,
                    data.extraction?.route
                      ? data.extraction.route.provider + '/' + data.extraction.route.model
                      : 'unavailable'
                  ),
                  h('dt', null, t('autoFacts')),
                  h('dd', null, badge(t(data.automaticFacts ? 'on' : 'off'))),
                  h('dt', null, t('pendingFacts')),
                  h('dd', null, data.pendingFacts),
                  h('dt', null, t('admission')),
                  h('dd', null, t(data.autonomy?.effective ? 'evaluated' : 'needsReview'))
                ),
                data.extraction?.blocked === 'remote-egress-disabled' &&
                  h('div', { className: 'sm-alert' }, t('remoteHint')),
                h(
                  'div',
                  { className: 'sm-stats' },
                  stat('pending', data.jobCounts?.pending ?? 0),
                  stat('completed', data.jobCounts?.done ?? 0),
                  stat('failed', data.jobCounts?.failed ?? 0)
                ),
                details(
                  'queue',
                  pre({
                    counts: data.jobCounts,
                    capacity: data.capacity,
                    oldestPendingAt: data.oldestPendingAt,
                    captureBacklog: data.captureBacklog
                  })
                ),
                h('h3', null, t('usage')),
                h(
                  'div',
                  { className: 'sm-stats' },
                  stat('tokens', data.budget?.used),
                  stat('reserved', data.budget?.reserved)
                ),
                details('budgetDetails', pre(data.budget)),
                h('h3', null, t('jobs')),
                !(data.jobs ?? []).length && h('p', { className: 'sm-muted' }, t('noJobs')),
                ...(data.jobs ?? []).map((j) =>
                  h(
                    'article',
                    { key: j.id },
                    h(
                      'div',
                      { className: 'sm-row-title' },
                      h('strong', null, j.kind || t('extraction')),
                      badge(j.state)
                    ),
                    j.error &&
                      h('p', null, typeof j.error === 'string' ? j.error : j.error.message),
                    details('technical', pre(j))
                  )
                ),
                details(
                  'advanced',
                  button('maintenance', () => action('maintenance', {})),
                  button('maintenancePreview', async () =>
                    setMaintenancePreview(await action('queue-maintenance', { dryRun: true }))
                  ),
                  maintenancePreview &&
                    h(
                      React.Fragment,
                      null,
                      pre(maintenancePreview),
                      button('compact', async () => {
                        if (
                          await action('queue-maintenance', {
                            dryRun: false,
                            expectedRevision: maintenancePreview.revision
                          })
                        )
                          setMaintenancePreview(null)
                      })
                    ),
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
                )
              ),
            !review &&
              tab === 'factReview' &&
              data &&
              h(
                React.Fragment,
                null,
                !(data.candidates ?? []).length && empty('noReviews', 'noReviewsDesc'),
                ...(data.candidates ?? []).map((c) =>
                  h(
                    'article',
                    {
                      key: c.id,
                      'data-candidate-id': c.id,
                      className: 'sm-record'
                    },
                    h('h3', null, c.content),
                    h('div', { className: 'sm-meta' }, badge(c.status)),
                    h('h4', null, t('statement')),
                    pre(c.quote),
                    h('h4', null, t('currentFact')),
                    h(
                      'p',
                      { className: 'sm-muted' },
                      factDetails?.id === c.id
                        ? factDetails.current?.content || t('noFacts')
                        : t('review')
                    ),
                    button('review', async () =>
                      setFactDetails((await action('fact-review', { id: c.id }))?.candidate ?? null)
                    ),
                    h('h4', null, t('evidence')),
                    ...(factDetails?.id === c.id ? factDetails.sources : []).map((e) =>
                      h(
                        'div',
                        { key: e.id },
                        h('p', null, e.text),
                        details('sourceDetails', pre(e))
                      )
                    ),
                    c.status === 'proposed' &&
                      h(
                        React.Fragment,
                        null,
                        field('reason', factReasons[c.id] ?? '', (value) =>
                          setFactReasons({ ...factReasons, [c.id]: value })
                        ),
                        ...[true, false].map((approve) =>
                          button(
                            approve ? 'approve' : 'reject',
                            () =>
                              action('fact-decide', {
                                id: c.id,
                                hash: c.hash,
                                approve,
                                reason: factReasons[c.id]
                              }),
                            !factReasons[c.id]?.trim() ||
                              !policy.policy?.mutate ||
                              (approve && (factDetails?.hash !== c.hash || (c.conflict && !c.base)))
                          )
                        )
                      )
                  )
                )
              ),
            !review &&
              tab === 'facts' &&
              data &&
              h(
                React.Fragment,
                null,
                !(data.facts ?? []).length && empty('noFacts', 'noFactsDesc'),
                ...(data.facts ?? []).map((f) =>
                  h(
                    'article',
                    {
                      key: f.id,
                      className: 'sm-record'
                    },
                    h('p', null, f.content || '[' + f.status + ']'),
                    h(
                      'div',
                      { className: 'sm-meta' },
                      badge(f.status),
                      f.pinned && badge(t('pinned')),
                      t('revision') + ' ' + f.revision
                    ),
                    f.status !== 'deleted' &&
                      h(
                        'div',
                        null,
                        button('update', () => {
                          setEditing({ id: f.id, content: f.content, revision: f.revision })
                          setDeleting(null)
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
                          setDeleting(f.id)
                          setEditing(null)
                        }),
                        editing?.id === f.id &&
                          h(
                            'div',
                            { className: 'sm-editor' },
                            field(
                              'content',
                              editing.content,
                              (content) => setEditing({ ...editing, content }),
                              true,
                              true
                            ),
                            button(
                              'saveFact',
                              async () => {
                                if (
                                  await action('mutate', {
                                    op: 'update',
                                    id: f.id,
                                    content: editing.content,
                                    expectedRevision: editing.revision,
                                    idempotencyKey: crypto.randomUUID()
                                  })
                                )
                                  setEditing(null)
                              },
                              !editing.content.trim() || !policy.policy?.mutate
                            ),
                            button('cancel', () => setEditing(null))
                          ),
                        deleting === f.id &&
                          h(
                            'div',
                            { className: 'sm-editor' },
                            h('p', null, t('deleteHint')),
                            button(
                              'deleteFact',
                              async () => {
                                if (
                                  await action('mutate', {
                                    op: 'delete',
                                    id: f.id,
                                    expectedRevision: f.revision,
                                    idempotencyKey: crypto.randomUUID()
                                  })
                                )
                                  setDeleting(null)
                              },
                              !policy.policy?.mutate
                            ),
                            button('cancel', () => setDeleting(null))
                          )
                      )
                  )
                ),
                !adding && button('add', () => setAdding(true), !policy.policy?.mutate),
                adding &&
                  h(
                    'div',
                    { className: 'sm-editor' },
                    field('content', draft, setDraft, true, true),
                    button(
                      'saveFact',
                      async () => {
                        if (
                          await action('mutate', {
                            op: 'add',
                            content: draft,
                            expectedRevision: 0,
                            idempotencyKey: crypto.randomUUID()
                          })
                        ) {
                          setDraft('')
                          setAdding(false)
                        }
                      },
                      !draft.trim() || !policy.policy?.mutate
                    ),
                    button('cancel', () => {
                      setAdding(false)
                      setDraft('')
                    })
                  ),
                details(
                  'transfer',
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
                )
              ),
            !review &&
              tab === 'candidates' &&
              data &&
              h(
                React.Fragment,
                null,
                !(data.candidates ?? []).length && empty('noProcedures', 'noProceduresDesc'),
                ...(data.candidates ?? []).map((c) =>
                  h(
                    'article',
                    {
                      key: c.id,
                      'data-candidate-id': c.id,
                      className: 'sm-record'
                    },
                    h('strong', null, c.package.name),
                    ' · ' + c.status + ' · ' + c.trust,
                    button('review', async () => {
                      reviewTrigger.current = c.id
                      setReason('')
                      setReview(await action('review', { id: c.id }))
                    })
                  )
                ),
                h('h3', null, t('active')),
                !(data.publications ?? []).length &&
                  h('p', { className: 'sm-muted' }, t('noActive')),
                ...(data.publications ?? []).map((p) =>
                  h(
                    'article',
                    { key: p.name },
                    h(
                      'p',
                      null,
                      p.name + ' · ' + (p.archived ? t('archive') : p.active ? t('on') : t('off'))
                    ),
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
                      async () => {
                        const options = await action('outcome-options', {
                          name: p.name,
                          hash: p.active
                        })
                        if (options)
                          setOutcome({
                            name: p.name,
                            hash: p.active,
                            exposure: '',
                            evidence: [],
                            options
                          })
                      },
                      !p.active
                    )
                  )
                ),
                outcome &&
                  h(
                    'fieldset',
                    null,
                    h('legend', null, t('outcomes') + ' ' + outcome.name),
                    h(
                      'label',
                      null,
                      t('exposure'),
                      h(
                        'select',
                        {
                          value: outcome.exposure,
                          disabled: busy,
                          onChange: (e) =>
                            setOutcome({ ...outcome, exposure: e.target.value, evidence: [] })
                        },
                        h('option', { value: '' }, t('exposure')),
                        ...outcome.options.exposures.map((o) =>
                          h('option', { key: o.id, value: o.id }, o.session + ' / ' + o.seq)
                        )
                      )
                    ),
                    ...(
                      outcome.options.exposures.find((o) => o.id === outcome.exposure)?.evidence ??
                      []
                    ).map((e) =>
                      h(
                        'label',
                        { key: e.id, style: { display: 'block' } },
                        h('input', {
                          type: 'checkbox',
                          checked: outcome.evidence.includes(e.id),
                          disabled: busy,
                          onChange: (event) =>
                            setOutcome({
                              ...outcome,
                              evidence: event.target.checked
                                ? [...outcome.evidence, e.id]
                                : outcome.evidence.filter((id) => id !== e.id)
                            })
                        }),
                        e.seq + ': ' + e.text
                      )
                    ),
                    ...['success', 'failure'].map((kind) =>
                      button(
                        kind,
                        async () => {
                          if (
                            await action('outcome', {
                              name: outcome.name,
                              hash: outcome.hash,
                              session: outcome.options.exposures.find(
                                (o) => o.id === outcome.exposure
                              )?.session,
                              seq: outcome.options.exposures.find((o) => o.id === outcome.exposure)
                                ?.seq,
                              evidence: outcome.evidence,
                              kind
                            })
                          )
                            setOutcome(null)
                        },
                        !outcome.exposure || !outcome.evidence.length
                      )
                    )
                  )
              ),
            !review &&
              ['facts', 'factReview', 'candidates', 'status'].includes(tab) &&
              (data?.total ?? data?.jobTotal ?? 0) > 25 &&
              h(
                'div',
                { className: 'sm-pagination' },
                h('span', null, t('page') + ' ' + (offset / 25 + 1)),
                button('back', () => setOffset(Math.max(0, offset - 25)), offset === 0),
                button(
                  'next',
                  () => setOffset(offset + 25),
                  !data || offset + 25 >= (data.total ?? data.jobTotal)
                )
              ),
            review &&
              h(
                'section',
                {
                  'aria-label': t('review'),
                  className: 'sm-review',
                  ref: reviewPanel,
                  tabIndex: -1
                },
                button('close', closeReview),
                h('h3', null, review.candidate.package.name),
                h('p', { className: 'sm-muted' }, t('reviewSteps')),
                h(
                  'div',
                  { className: 'sm-meta' },
                  badge(review.candidate.status),
                  review.candidate.trust
                ),
                h('h4', null, t('proposed')),
                h(
                  'div',
                  { className: 'sm-review-body' },
                  review.candidate.package.content ||
                    review.candidate.package.body ||
                    review.candidate.package.description
                ),
                ...Object.entries(review.candidate.package.resources ?? {}).map(([path, content]) =>
                  h(
                    'div',
                    { key: path, className: 'sm-resource' },
                    h('h4', null, path),
                    pre(content)
                  )
                ),
                h('p', { className: 'sm-muted' }, review.candidate.package.applicability),
                details(
                  'changes',
                  ...review.diff.map((change) =>
                    h(
                      'div',
                      { key: change.field },
                      h('h4', null, change.field),
                      change.before !== null && pre(change.before),
                      pre(change.after)
                    )
                  )
                ),
                review.previous && details('previous', pre(review.previous)),
                details('validation', pre(review.candidate.validation)),
                details('technical', pre(review.candidate.package)),
                h('h4', null, t('evidence')),
                ...review.evidence.map((e) =>
                  h(
                    'article',
                    { key: e.id },
                    h('p', null, e.text),
                    details('sourceDetails', pre(e)),
                    button(
                      'revoke',
                      async () => {
                        if (await action('revoke-evidence', { id: e.id })) setReview(null)
                      },
                      e.revoked
                    )
                  )
                ),
                h(
                  'div',
                  { className: 'sm-review-actions' },
                  field('reason', reason, setReason, true)
                ),
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
                button('close', closeReview)
              )
          )
          return h('div', { className: 'sm-page' }, content)
        }
        ctx.slots.inject('main', () => {
          const panel = ctx.slots.register(
            { name: 'main', key: 'strique-memory', label: () => t('title') },
            Card
          )
          const navigation = ctx.slots.inject('sidebar.panellist', () =>
            ctx.slots.register(
              {
                name: 'sidebar.panellist',
                id: 'strique-memory',
                order: 30,
                label: () => t('navigation')
              },
              ({ size }) => icon('memory', size)
            )
          )
          return () => {
            navigation()
            panel()
          }
        })
      }
    }
  }
})
