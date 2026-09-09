# Strique DSH 记忆与流程学习

内部预发布版本：**0.3.0-internal.1**。基于 [haitang1/dsh-memory](https://github.com/haitang1/dsh-memory) 的 MIT 分支，由 [DigiStrique-Solutions](https://github.com/DigiStrique-Solutions/dsh-memory) 维护。

此插件保存项目事实，从 Host 会话证据中提出可审核的流程，并通过现有 DSH 技能注册表提供已批准的版本。审核界面显示先前和候选的完整流程包、资源、来源证据和版本哈希。撤销事实或证据会立即停用依赖它们的流程。这是流程学习，不是训练模型权重。

默认仅支持一个通过认证的本地用户。模型工具只使用 Host 确定的项目范围；全局偏好必须由用户明确保存。默认使用本地词法检索，远程证据发送关闭，流程发布需要用户审核。不会自动修改旧数据或日常使用的配置。

## 安装与兼容

目标是 DSH **0.1.5-alpha.1**、Cordis **4.0.2**，Node 22 或更新版本。本地验证使用 Node 26.4.0。CI 配置包含 Node 22、24、26，配置矩阵并不代表远程 CI 已通过。实际证据见 [运维说明](docs/OPERATIONS.md)。

运行 `npm ci --ignore-scripts`、`npm run check`、`npm pack --ignore-scripts`。在隔离的 `DSH_HOME` 中执行 `dsh plugin --profile web add /绝对路径/strique-dsh-memory-0.3.0-internal.1.tgz`。插件包含可独立切换的 `strique-memory`、`strique-memory-tools`、`strique-memory-learning`、`strique-memory-web`，设置中显示“记忆与学习”。正式启用前移除旧的 `dsh-memory` 行。不要为了消除 peer 提示而安装第二份 Cordis 运行时。

## 使用

模型工具为 `memory_read`、`memory_search`、`memory_mutate`、`memory_stats`、`learning_evidence` 和 `learning_propose`。修改需要当前事实版本与唯一幂等键；新增时版本为 `0`。工具不能提供自己的用户身份、全局范围或审核权限。

学习任务保存完整事件范围、水位、重试、预算和失败原因。用户陈述、工具观察、模型声明和中断不会混为“验证成功”。候选流程必须经过验证和用户审核，过期哈希会被拒绝。审核界面支持归档、恢复、固定、回滚、撤销证据、暂停提取和记录结果。技能加载只算接触记录，不等于成功；成功或失败必须由用户结合工具证据确认。

导入和导出使用浏览器中的有限 JSON，不接受模型提供的任意 Host 文件路径。导入先预览，再使用对应的哈希和版本应用。

## 配置

记忆策略通过 DSH 的 `strique-memory` 设置实时生效，不包含 API 密钥。凭据由所选的 DSH 模型提供方负责解析和轮换。

| 配置 | 默认值 | 含义 |
|---|---|---|
| `read` | `true` | 允许读取、召回和技能发现。 |
| `capture` | `true` | 允许证据采集、候选、任务及结果记录。 |
| `mutate` | `true` | 允许事实修改和预览后的导入。 |
| `publish` | `true` | 允许审核后的流程发布与维护。 |
| `export` | `true` | 允许本地用户导出事实。 |
| `remoteEgress` | `false` | 允许向配置的模型发送有限证据。 |
| `recallBytes` | `8192` | 召回字节预算，范围 512 至 32768。 |

学习行参数为 `enabled: true`、`provider: ''`、`model: ''`、`dailyTokens: 20000`、`maxTokens: 2048`、`timeoutMs: 60000`。空路由使用当前 DSH 模型选择；路由缺失时任务保持待处理。行配置修改遵循 Cordis 生命周期。关闭提取仍可保留已批准技能的发现。每日预算按范围计算，以输入 UTF-8 字节、输出额度和提示开销保守预留，崩溃后仍保留预留量。

## 评估与自动批准

`npm run eval` 运行确定性安全检查，不证明学习效果提升。真实模型比较使用 `node scripts/evaluate.mjs --driver /路径/driver.mjs --corpus /路径/corpus.json`。评估答案不发送给模型。

自动批准默认关闭。必须由本地用户审核真实模型报告并明确启用：每种模式至少 30 个配对留出试验、全部安全检查通过、相对仅记忆模式至少改善 6 个试验且没有未解释的回退。不支持仅凭助手声明自动批准。用户必须确认报告和判定规则的来源；JSON 报告本身不是可信证明。测试或安装不会启用自动策略。

## 存储与迁移

Host 使用 DSH `storageDomain`。每个范围是一个有界原子记录，包含事实、删除标记、幂等回执、证据、候选、任务及发布指针。不可变流程包保存在 `$DSH_HOME/strique-memory-v1/objects`。同一 Home 的写入锁不会自动过期。

先完整备份旧目录，再执行 `dsh-memory-migrate 旧目录 > migration-preview.json`。该命令不修改来源。逐条核对报告和原文件，在界面粘贴报告的 `data`，预览后应用。重复 ID、歧义 Markdown 和检测到的凭据会隔离。旧格式无法恢复全部原始意图，不会自动迁移摘要或 AGENTS 内容。

MCP 必须显式设置 `DSH_MEMORY_MODE=separate`、`DSH_MEMORY_DIR=/独立存储`、`DSH_MEMORY_PROJECT=/项目`。它使用相同事实验证和独占锁，不能共享 Host 存储、批准流程、写出任意文件或扩大范围。

旧 Markdown 权威存储、14 工具接口、远程向量嵌入、自动 AGENTS 种子及 Windows 部署脚本不再支持。迁移、恢复、验证和限制见 [运维说明](docs/OPERATIONS.md)。
