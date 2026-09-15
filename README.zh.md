# Strique DSH 记忆与流程学习

内部预发布版本：**0.4.0-internal.1**。基于 [haitang1/dsh-memory](https://github.com/haitang1/dsh-memory) 的 MIT 分支，由 [DigiStrique-Solutions](https://github.com/DigiStrique-Solutions/dsh-memory) 维护。

此插件保存项目事实，从 Host 会话证据中提出可审核的流程，并通过现有 DSH 技能注册表提供已批准的版本。审核界面显示先前和候选的完整流程包、资源、来源证据和版本哈希。撤销事实或证据会立即停用依赖它们的流程。这是流程学习，不是训练模型权重。

默认仅支持一个通过认证的本地用户。模型工具只使用 Host 确定的项目范围；全局偏好必须由用户明确保存。默认使用本地词法检索，远程证据发送关闭，流程发布需要用户审核。不会自动修改旧数据或日常使用的配置。

## 安装与兼容

目标是 DSH **0.1.6-alpha.1**、Cordis **4.0.2**，Node 22 或更新版本。本地验证使用 Node 26.4.0。CI 配置包含 Node 22、24、26，配置矩阵并不代表远程 CI 已通过。实际证据见 [运维说明](docs/OPERATIONS.md)。

运行 `npm ci --ignore-scripts`、`npm run check`、`npm pack --ignore-scripts`。在隔离的 `DSH_HOME` 中执行 `dsh plugin --profile web add /绝对路径/strique-dsh-memory-0.4.0-internal.1.tgz`。插件包含可独立切换的 `strique-memory`、`strique-memory-tools`、`strique-memory-learning`、`strique-memory-web`，侧栏中的“记忆”打开独立主面板。正式启用前移除旧的 `dsh-memory` 行。不要为了消除 peer 提示而安装第二份 Cordis 运行时。

## 使用

模型工具为 `memory_read`、`memory_search`、`memory_mutate`、`memory_stats`、`learning_evidence` 、`learning_resource` 和 `learning_propose`。修改需要当前事实版本与唯一幂等键；新增时版本为 `0`。工具不能提供自己的用户身份、全局范围或审核权限。

学习任务保存完整事件范围、水位、重试、预算和失败原因。用户陈述、工具观察、模型声明和中断不会混为“验证成功”。候选流程必须经过验证和用户审核，过期哈希会被拒绝。审核界面支持归档、恢复、固定、回滚、撤销证据、暂停提取和记录结果。技能加载只算接触记录，不等于成功；成功或失败必须由用户结合工具证据确认。

导入和导出使用浏览器中的有限 JSON，不接受模型提供的任意 Host 文件路径。导入先预览，再使用对应的哈希和版本应用。

事实提取只在持久化的 `turn/end` 后安排；flush 仅采集证据。自动事实必须匹配原始用户陈述，引用、假设、推断及冲突进入“事实审核”。这些规则和模型分类仍是启发式方法，不能保证语义完全正确。撤销来源会归档事实并停用依赖流程。

技能目录仅包含元数据；主技能加载说明和资源索引，`learning_resource` 每次重新验证项目、可见性和版本后读取一个资源。用户确认的失败会触发针对同一版本的修订。状态页分别显示采集、提取、自动事实、流程批准、容量和实际用量；未知用量不会被当作零。完成的队列记录可清理，待处理和被引用的证据保留。

## 配置

记忆策略通过 DSH 的 `strique-memory` 设置实时生效，不包含 API 密钥。凭据由所选的 DSH 模型提供方负责解析和轮换。

| 配置 | 默认值 | 含义 |
|---|---|---|
| `read` | `true` | 允许读取、召回和技能发现。 |
| `capture` | `true` | 允许证据采集、候选、任务及结果记录。 |
| `autoFacts` | `true` | 提取后自动保存明确且无冲突的用户事实；推断和冲突仍需审核。 |
| `mutate` | `true` | 允许事实修改和预览后的导入。 |
| `publish` | `true` | 允许审核后的流程发布与维护。 |
| `export` | `true` | 允许本地用户导出事实。 |
| `remoteEgress` | `false` | 允许向配置的模型发送有限证据。 |
| `recallBytes` | `8192` | 召回字节预算，范围 512 至 32768。 |

学习行参数为 `enabled: true`、`provider: ''`、`model: ''`、`dailyTokens: 20000`、`maxTokens: 2048`、`inputBytes: 12288`、`timeoutMs: 60000`。空路由使用当前 DSH 模型选择；路由缺失时任务保持待处理。行配置修改遵循 Cordis 生命周期。关闭提取仍可保留已批准技能的发现。每日预算按范围计算，以输入 UTF-8 字节、输出额度和提示开销保守预留，崩溃后仍保留预留量。

## 评估与自动批准

`npm run eval` 运行确定性安全检查，不证明学习效果提升。真实模型比较使用 `node scripts/evaluate.mjs --driver /路径/driver.mjs --corpus /路径/corpus.json`。评估答案不发送给模型。

自动批准默认关闭。必须由本地用户审核真实模型报告并明确启用：使用 `session-learning-v2` 端到端协议，每种模式每次重复至少 30 个配对留出任务，至少两次独立重复、全部安全检查通过、相对仅记忆模式至少改善 6 个试验且没有未解释的回退。不支持仅凭助手声明自动批准。用户必须确认报告和判定规则的来源；JSON 报告本身不是可信证明。报告必须绑定当前插件代码、运行时和实际策略/路由；配置改变后需重新评估。测试或安装不会启用自动策略。

## 存储与迁移

Host 使用 DSH `storageDomain`。每个范围是一个有界原子记录，包含事实、删除标记、幂等回执、证据、候选、任务及发布指针。不可变流程包保存在 `$DSH_HOME/strique-memory-v2/objects`。同一 Home 的写入锁不会自动过期。

schema-v1 域升级使用 `dsh-memory-upgrade 冻结快照 原对象目录 新HOME/strique-memory-v2`，目标目录必须不存在。旧数据不变；Host 在写入锁保护下按哈希验证并仅导入一次。旧的不完整任务保持暂停，旧自动批准失效，旧模型自行报告的用量标记为未知。

先完整备份旧目录，再执行 `dsh-memory-migrate 旧目录 > migration-preview.json`。该命令不修改来源。逐条核对报告和原文件，在界面粘贴报告的 `data`，预览后应用。重复 ID、歧义 Markdown 和检测到的凭据会隔离。旧格式无法恢复全部原始意图，不会自动迁移摘要或 AGENTS 内容。

MCP 必须显式设置 `DSH_MEMORY_MODE=separate`、`DSH_MEMORY_DIR=/独立存储`、`DSH_MEMORY_PROJECT=/项目`。它使用相同事实验证和独占锁，不能共享 Host 存储、批准流程、写出任意文件或扩大范围。

旧 Markdown 权威存储、14 工具接口、远程向量嵌入、自动 AGENTS 种子及 Windows 部署脚本不再支持。迁移、恢复、验证和限制见 [运维说明](docs/OPERATIONS.md)。

## 记忆工作区

点击主侧栏中的 **记忆**，在独立主面板中查看和管理记忆，无需进入插件设置。侧栏收起时保留图标入口。**返回聊天** 会回到当前会话，策略配置位于工作区的“设置”标签。

事实支持在界面内添加、编辑和取消。编辑、归档与恢复、固定与取消固定、删除和刷新使用带无障碍名称及悬停与键盘提示的图标按钮。固定按钮暴露选中状态，批准与拒绝保留明确文字。事实审核与流程保留来源证据和绑定版本的批准操作。活动页汇总提取状态与用量，导入导出、技术详情及自动批准控制可按需展开。界面使用 Harness 的明暗主题，权限判断和持久化写入仍由经过身份验证的 Host 负责。
