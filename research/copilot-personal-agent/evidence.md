# Copilot 个人账号与 Agent 适配研究证据

研究日期为 2026-11-11。时区为 Asia/Shanghai。

## 研究范围

包含公开文档、固定提交源码检查、普通公开网页 HTTP 访问和四组离线实验。没有读取用户令牌或密码，没有登录个人账号，没有调用真实 Copilot 聊天，也没有执行模型返回的命令。原目标仓库保持未修改。

## 固定版本

| 项目 | 提交 | 提交时间 |
| --- | --- | --- |
| cramt/m365-copilot-proxy | 65905e881d6597040966aff9b087aa9a908b358a | 2026-10-19 |
| sums001/Windows-Copilot-API | 5b933d416e7e09095fc85ec9b895e28f8a2635de | 2026-10-30 |
| zumanm1/copilot-wraper | 6d807c5939af2364a7224b4b785d581caf699cf4 | 2026-04-10 |
| kedaya2025/copilot-gate | 5b307614b06631771828b04d7e21040db3f29d3f | 2026-07-12 |

远程提交与源码用 GitHub API、raw.githubusercontent.com 和 GitHub 连接器核对。维护时间不能证明当前协议实际可用。

## 已确认的源码事实

### 消费者与企业实现有可复用部分

Windows-Copilot-API 的 protocol.py 使用企业项目相同形式的 SignalR Chathub 地址。固定消费者场景为 OfficeWebFreeConsumerCopilot、licenseType 为 Free、tone 为 Magic。身份租户、OAuth scope、broker 和 redirect 与目标项目现有认证不同。这里只能推断传输代码值得复用，不能推断已有用户令牌可在两条场景间通用。

该项目 server/api.py 的请求 model 进入返回标签，client.chat 与 client.stream 未接收 model。server/schemas.py 未声明 tools、tool_calls、tool_call_id。不存在付费个人场景已验证的证据。

公开网页访问结果为 HTTP 200，最终地址 https://copilot.com/，标题 Microsoft Copilot | Sign in，正文含 substrate.office.com DNS 预取。没有进入登录后的聊天页面。

### 提供 Messages 路由仍可能只支持文本

copilot-wraper 的 models.py 中 AnthropicRequest 文档明确扩展 tools 字段接受后忽略；server.py 非流式 Anthropic 响应只包含 text content block。文章不依据 README 的 PASS 标签推断文件工具闭环可用。

### 原工具集成测试有宽松分支

目标项目 packages/proxy-lib/src/index.test.ts 第 73 行检查 tool_calls，缺少调用时转到第 125 行附近的内容非空检查。我们的反例证明断言允许纯文本回复，并未测量真实后端表现。其他测试与 benchmark 不在这条结论的覆盖范围内。

### 模型名、窗口、参数、计量

packages/core/src/copilot.ts 第 150 行开始的 getToneForModel 为未知模型提供回退。packages/proxy-lib/src/handler.ts 第 932、938 行的响应携带解析后的 model 变量。因此模型标签本身不验证上游身份。同 tone 在不同 scenario 下也可能不同，不能把所有同 tone 的别名一律视为同真实模型。

packages/proxy-lib/src/index.ts 第 25 行附近说明上下文与输出数值仅为提示，默认均为 1000000。本研究用 fixture 模型执行原函数，确认该数值独立于真实模型探测。

temperature 和 max_tokens 在请求 schema 中声明，但本次对 core/proxy-lib 生产源码的搜索仅找到这两处，未找到传入聊天执行的使用。标准 token usage 由 handler.ts 第 1060 行附近填为零，另有 M365 扩展的额度字段。零 token 不能当作实际消耗计量。

## 四组离线实验

运行环境为 Node.js v24.18.0。脚本使用 Node 内置 stripTypeScriptTypes 将读取的 TypeScript 在内存中转换。原始文件 SHA-256 见 offline-results.json。

1. 原集成测试正文保留，替换 vitest 和 createApp 两个 import。假应用只返回普通文本、模型列表和健康响应。原断言结果为 3/3 通过，聊天请求 1 次，tool_calls 0，实际工具执行 0。
2. 抽取并执行原模型映射表、正则常量与 getToneForModel。不存在的普通模型名回退 magic，不存在的 claude 开头名字回退 Claude_Sonnet。未连接任何模型。
3. 执行原 buildModelsPayload，模型发现函数换成只返回 offline-fixture 的替身。四个能力字段都显示 1000000。未发送任何长上下文请求。
4. 执行原 fenced.ts 与 tools.ts，日志替换为空实现，模型查询替换成一旦使用就抛错的实现。bash 样例被解析成调用方 shell 工具，纯文本完成声明无调用；短建议代码块也可被解析。未执行这些命令。

这些是隔离、定向的行为实验，不是完整测试套件运行，不是端到端聊天评测，也不是生产安全审计。

## 复现

准备 Node.js 24，并将目标仓库切到固定提交。已有其他修改时请使用单独副本，不要重置已有工作目录。

```powershell
node .\reproduce.mjs '..\m365-copilot-proxy' .\your-results.json
```

其他系统可以使用同样两个参数传入本机仓库路径和报告路径。脚本没有 npm 依赖，不主动访问网络，不调用真实 createApp 或认证模块。会在控制台显示原测试打印的假响应，最后输出 JSON。Node 可能提示 stripTypeScriptTypes 属于实验性功能。

## 结论边界与下一步

最优先验证新版消费者正常登录与 SignalR 聊天。成功以后再验证少量工具在 Hermes 中完成读取、修改、检查的真实循环。个人付费场景、真实模型身份、限流、持续登录、多会话隔离，以及 Codex Responses 与 Claude Code Messages 的完整兼容仍未验证。

旧 copilot-gate README 里约半小时 clearance 到期的描述属于旧实现作者记录。新候选的 2026-10-30 提交报告删除了旧 clearance 逻辑，因此不能把半小时限制直接当作最新消费者服务的事实。

## 主要公开来源

- https://github.com/sums001/Windows-Copilot-API/commit/5b933d416e7e09095fc85ec9b895e28f8a2635de
- https://github.com/sums001/Windows-Copilot-API/blob/5b933d416e7e09095fc85ec9b895e28f8a2635de/copilot/protocol.py
- https://github.com/sums001/Windows-Copilot-API/blob/5b933d416e7e09095fc85ec9b895e28f8a2635de/server/api.py
- https://github.com/sums001/Windows-Copilot-API/blob/5b933d416e7e09095fc85ec9b895e28f8a2635de/server/schemas.py
- https://github.com/zumanm1/copilot-wraper/blob/6d807c5939af2364a7224b4b785d581caf699cf4/models.py
- https://github.com/zumanm1/copilot-wraper/blob/6d807c5939af2364a7224b4b785d581caf699cf4/server.py
- https://github.com/cramt/m365-copilot-proxy/tree/65905e881d6597040966aff9b087aa9a908b358a
- https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/api/ai-services/chat/copilotroot-post-conversations
- https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/api/ai-services/chat/overview
- https://developers.openai.com/codex/config-reference/
- https://code.claude.com/docs/en/llm-gateway-protocol.md
- https://hermes-agent.nousresearch.com/docs/integrations/providers
