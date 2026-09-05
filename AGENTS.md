# AGENTS.md — dsh-memory 项目指南

本文件给在这个仓库上工作的所有 agent 使用。核心结论来自实际分析：架构分层、与 DSH 的兼容红线、测试与发布流程。**改动前先读；与本文件冲突的事实以（package.json / lib/ / README）为准，并顺手修正本文件。**

## 1. 项目概览

- **定位**：DeepSeek Harness（DSH）的类 Codex 持久记忆插件——全局摘要注入每次提示词、14 个 `memory_*` 工具读写、每轮自动蒸馏、定期合并、版本化回滚；另附独立 stdio MCP server 与 Web 设置卡片。
- **当前版本**：0.2.9（MIT，ESM，`engines: node >= 20.3`）。
- **零运行时第三方依赖**：`dependencies` 为空，只有 `peerDependencies`（见红线 3）。仓库无 lockfile、无构建步骤、无 lint/typecheck——保持可读可跑，防漂移靠 `npm run check`。

## 2. 架构与模块地图

| 模块 | 职责 | 依赖边界 |
| --- | --- | --- |
| `lib/store.js` | 存储原语：raw/journal/summary 解析、序列化、BM25+bigram 搜索、本地 256 维哈希向量、远程 `/embeddings` 合并、凭据检测、`MemoryStore`（锁/原子写/作用域/归档/backfill） | **零 harness 依赖**（node builtins only） |
| `lib/web.js` | 同源设置端点 `/_dsh/memory/settings`（GET/POST、同源校验、409 冲突、CSP） | 零 harness 依赖 |
| `lib/browser.js` | 自包含单文件 HTML 记忆浏览器 | 零 harness 依赖 |
| `lib/automation.js` | `AUTO_MEMORY_SKILL` 定义、`resolveSummarizeRoute` 路由回退链、`extractMessageText`（user/assistant 事件结构差异） | 零 harness 依赖 |
| `lib/index.js` | 唯一宿主接线层：`apply()`（settings/tools/skills 注入、systemPrompt.context、turn-stopping）、`toolDefinitions()`（14 工具）、蒸馏/合并管线 | **唯一允许 import `@deepseek-ai/*`**（dsh-llm / dsh-tools / schemastery） |
| `lib/client.js` | Web 客户端 bundle：`settings.plugin.item` keyed 槽位，`key:'memory'`，en/zh 双语 22 字段表单 | 仅 client 运行时（同源 `fetch` 到 `/_dsh/memory/settings`；无 eval / localStorage / 跨域请求） |
| `bin/dsh-memory-mcp.mjs` | 独立 stdio MCP server（9 工具），复用 `lib/store.js` | 仅 node builtins |
| `scripts/` | `check-release.mjs`（版本/测试数一致性）、`mcp-smoke.mjs`、Windows 部署/重启/校验 `.ps1` | — |
| `docs/`、`test/`、`.github/workflows/ci.yml`、`cordis.patch.yml`、`examples/mcp-config.json` | 见后文 | — |

**架构原则**：`store/web/browser/automation` 四模块可脱离 harness 单测（纯 Node 直跑）；所有 DSH 服务面收敛在 `index.js`。新增逻辑优先放纯逻辑模块，并保持零 import。

## 3. 红线（违反会直接崩/被 CI/运行时抓）

1. **`settings.register('memory', …)` 用裸字符串；禁止 `settingsNamespace`**。dsh-settings@0.1.2-rc.1 已移除 `settingsNamespace` 导出，0.2.8 之前宿主在 0.1.2-rc.1 上直接报 `The requested module does not provide an export named 'settingsNamespace'`。
2. **`AUTO_MEMORY_SKILL` 必须带 `source: 'runtime'`**。注册期不校验、加载期校验——漏掉会导致技能出现在目录却加载报错（0.2.7 的教训）。
3. **peerDependencies 与已验证的 DSH 线对齐**：`dsh-llm / dsh-settings / dsh-tools` = `^0.1.2-rc.1`，`cordis` = `^4.0.1`，`schemastery` = `^3.18.0`。**DSH 是 pre-1.0，同 minor 内可出现破坏性变更，semver 满足 ≠ 运行时兼容**；升级 DSH 必须先验证再改范围（0.1.1→0.1.2 已发生一次）。
4. **新增配置键四同步**：`Config`（`lib/index.js` z.object）→ `lib/types/index.d.ts` → README 配置表（en/zh）→ `lib/client.js` 卡片（en+zh 标签/提示）。漏一处即出现文档漂移。
5. 四个纯逻辑模块（store/web/browser/automation）**禁止**新增任何 `@deepseek-ai/*` import——CI 零依赖直跑是它们换来的。
6. 宿主接线改动（`apply()`/`toolDefinitions()`）没有自动化运行时覆盖，改完必须同时更新/运行 `test/host-wiring.test.js` 且做一次真实部署验证，不能只靠"能 import"。

## 4. 存储格式与一致性

`$DSH_HOME/memories/`（默认）：

```
memory_summary.md         注入体：# DSH memory + vN 版本行 + ## 分节
raw_memories.md           追加式条目（### 时间 + **id:**/**tags:**/**importance:** + 正文）
rollout_summaries/<sid>.md 每会话轮次摘要块（## ISO 时间 + 文本）
journal.jsonl             {seq,op,id,ts,entry} 追加日志，合并游标按 seq 消费
summary_history/<v>.<ts>.<u8>.md  保留版本供 memory_rollback
archive/raw-YYYY-MM.md    超出 rawArchiveMaxBytes 后归档的最旧条目
scopes/ws-<hash>/ project-<hash>/  scopedMemory 开启时的作用域库
state.json                版本/游标/AGENTS.md 指纹
diagnostics.json          启动诊断（工具注册、技能注册、错误）
.memory.lock              跨进程锁（60s stale；非持锁实例只读）
```

- 写入全是 **tmp + rename 原子写**；journal 损坏行跳过（游标保持落后）；合并前**严格校验输出**（`# DSH memory`、独立 `vN`、至少一个 `##` 节），畸形拒绝并保留旧版；截断按完整行、不留下未闭合代码围栏。
- 合并只消费「新 rollout 块 + 游标之后的 journal 事件」，游标在写入成功后推进；每会话摘要防抖 5min、并发上限 4、rollout 文件上限 16、合并间隔 10min。
- 注入：`systemPrompt.context({name:'dsh-memory', order:2000, text})` 每次组装时同步重读，写入后下一步生效；读失败返回空串不阻塞会话。
- 安全：注入前 `redactSecrets`（默认开）、`memory_add` 默认拒绝明显凭据（`allowSecret:true` 放行）、`readOnlyScopes` 阻断写工具。

## 5. 工具与技能

14 个 `memory_*` 工具（`toolDefinitions`）：`read / add / update / delete / search / merge / review / export / import / stats / browse / history / rollback / sync`。

- 作用域：`global`（默认）/ `workspace`（`ws-<hash>`，会话 cwd）/ `project`（`project-<hash>`，最近 git 根）；`scopedMemory: true` 时启用后两者，注入预算 global+workspace 拆分。
- 搜索：BM25 + 全词/标签/新近度加权，bigram 模糊兜底；`vector:true` 时叠加本地 256 维哈希向量 cosine（阈值 0.3），配置 `embeddingBaseURL/apiKey/model` 时走 OpenAI 兼容 `/embeddings` 并与 BM25 合并。
- LLM 摘要：模型路由回退链 = `summarizeProvider/summarizeModel` → `agentDefaultModel.currentSelection()` → `agent-default-model` 设置命名空间；内部调用 `reasoningEffort:'off'`（不支持时自动降级重试）；60s 超时、失败按类重试（max tokens/工具调用/unsupported finish reason 不重试）。
- `auto-memory` 运行时技能：指导代理主动识别（偏好/决策/约定/修复/事实）并 `memory_add`（tags+去重）、依赖历史时 `memory_search/memory_read`、修正过时条目。**定义只在 `lib/automation.js`**。

## 6. 测试体系

- `npm test` = **64 项**（node:test，约 0.3s）：`store`（存储语义/journal/历史/归档/作用域）、`automation`（技能定义/路由回退链/事件文本提取）、`browser`（HTML 快照）、`web-settings`（端点生命周期 + VM 沙箱卡片注册）、`embedding.integration`（fake `/embeddings` + 本地向量）、`mcp.integration`（真实子进程往返）、`host-wiring`（见下）。
- **零依赖原则**：CI（`.github/workflows/ci.yml`，node 20/22，push main + PR）**不 install**，直接 `npm run check && npm test`。任何测试新增对第三方包的硬依赖都会让 CI 崩。
- `test/host-wiring.test.js`：①源码守卫——`settings.register('memory'…` 存在、`settingsNamespace` 不存在、`snapshotEvents` 存在且 `session.events.entries()` 不存在、14 工具名齐全、`agent/turn-stopping`/`systemPrompt.context`/`AUTO_MEMORY_SKILL` 存在；②fake-ctx `apply()` 冒烟——断言裸字符串命名空间、14 工具注册、技能、注入钩子、settings 路由。**当 harness 包不可解析时必须 `t.skip()` 而非报错**（CI 情形），且**不能改变 `# tests` 计数**（check-release 依赖该计数）。
- `npm run check`（`scripts/check-release.mjs`）契约：`package.json.version` == CHANGELOG 最新 `## <ver>` == README 两语版本行（`Current release: **X**` / `当前版本：**X**`）；README 声明的测试数（`runs N tests` / `运行 N 项测试`）== 实际 `node --test` 的 `# tests N`。**这些措辞是解析契约，改动措辞必须同步改脚本。**

## 7. 发布流程（0.2.8 起的标准动作）

1. 代码改动（含 `test/` 更新）；
2. `package.json` bump 版本 + `CHANGELOG.md` 顶部新条目（`## <ver> (YYYY-MM-DD)`，写清为何修/影响面）；
3. 同步文档：README 两语（版本、测试数、新测试文件、与 DSH 版本适配说明）、`docs/STATUS.md` 当前状态块、`lib/types/*.d.ts`（默认值注释）；
4. `npm run check` + `npm test` 全绿；
5. `git commit`（信息含 release: vX.Y.Z 摘要）→ `git tag -a v<ver> -m <摘要>` → `git push origin main` + 推送标签。
- 版本号/测试数/工具数任何一处与 README 不一致，`npm run check` 会红——这是特性，不是烦恼。
- 历史版本标签：v0.2.5 / v0.2.6 / v0.2.7 / v0.2.8 / v0.2.9（更早版本未补标签）。

## 8. 部署（现状）

- 线上 profile：`~/.dsh/profiles/web/`；`package.json` 中 `dependencies["@dsh-external/dsh-memory"] = "github:haitang1/dsh-memory#<commit-sha>"`，`dsh.profile.bundles` 含 `@dsh-external/dsh-memory`；安装副本为**无 .git 的纯文件拷贝**（`node_modules/@dsh-external/dsh-memory/`）。
- 升级 = ①用仓库发布文件覆盖安装副本（`lib bin examples scripts cordis.patch.yml CHANGELOG.md README*.md LICENSE package.json`）②更新 profile pin 到新 sha ③重启。
- **重启必须用 supervised setsid 模式**：监督进程 cmdline **不得包含 pkill 模式串**（否则自杀），写独立脚本文件再由 setsid 分离执行；参考模板 `/tmp/dshweb-restart-v028.sh`（trace `/tmp/dshweb-restart-v028.trace`）。健康检查注意：`curl /` 会被 token 守卫拦出非 2xx，属误报，以**端口监听 + 服务横幅**为准。
- **验证依据**：`$DSH_HOME/memories/diagnostics.json` 重启后更新，且 `toolsRegistered` 列出 14 工具、`skillRegistered: true`、无 `skillError`；或 `dsh pluginInventory` 显示 enable。运行副本 = `dsh-settings 0.1.2-rc.1`（`register(ns,…)` 裸字符串、`settingsNamespace` 已无导出）。
- 独立 MCP：`DSH_MEMORY_DIR` + `DSH_MEMORY_REDACT=1`（默认），`bin/dsh-memory-mcp.mjs` 9 工具；AGENTS.md 种子来自 `$DSH_HOME/AGENTS.md`（`seedFromAgentsMd`，默认开；`memory_sync` 冲突检测）。

## 9. 已知坑与修复记录（教训）

| 版本 | 坑 | 修复 |
| --- | --- | --- |
| 0.2.7 | `AUTO_MEMORY_SKILL` 缺 `source`，技能目录可见但加载报错 | 补 `source:'runtime'` |
| 0.2.8 | DSH 0.1.2-rc.1 移除 `settingsNamespace`，宿主加载崩溃 | 改 `settings.register('memory',…)` + 收紧 peers + 新增 host-wiring 测试 |
| 0.1.2-rc.1 | `Session.events` 被 Surface 层替换（`snapshotEvents`/`deriveMessages`），`extractTurnText` 的 `.entries()` 在每次轮次摘要时抛 `Cannot read properties of undefined (reading entries)` | 迁移到 `agent.session.snapshotEvents(fromSeq)`（v0.2.9） |
| 常态 | DSH pre-1.0，同一 `^0.1.x` 范围内 API 可破 | 升级前验证；用 host-wiring 守卫兜底 |

**维护提示**：本文件是与代码平行的文档，改版本/工具数/CI/部署方式时同步更新；若与仓库不一致，以 package.json / lib / README / CHANGELOG 为准（并修本文件）。
