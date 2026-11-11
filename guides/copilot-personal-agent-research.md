# 个人版 Microsoft Copilot 的编程 Agent 接入研究

已经订阅 Microsoft 365 或 Copilot，能不能把这份订阅接到 Codex、Claude Code 或 Hermes，省下一套模型 API 费用。

这次调查围绕这个问题，检查了三个代理项目的源码，核对微软与客户端的官方文档，并运行了四组离线实验。资料核验截至 2026 年 11 月 11 日。实验没有登录个人账号，也没有向 Copilot 发送聊天请求，因此本文能确认的是代理实现与测试断言的行为，个人账号的实际可用性仍待验证。

已经有了一个值得继续做下去的发现。较新的消费者版实现也使用了 Microsoft 365 Copilot 的 SignalR 聊天地址，原项目的传输层可能比最初估计的更容易复用。

这条线索来自 Windows-Copilot-API 在 2026 年 10 月 30 日的提交。固定到该提交后，`copilot/protocol.py` 使用的地址是 `substrate.office.com/m365Copilot/Chathub/{oid}@{tenant}`，与 m365-copilot-proxy 属于同一条地址形式。[1]

调查中还对公开网页做了一次普通 HTTP 访问。访问 `copilot.microsoft.com` 后，最终地址为 `copilot.com`，返回状态为 200，页面标题是登录页，HTML 中也出现了对 `substrate.office.com` 的 DNS 预取。这个观察确认了公开入口的跳转，尚不能证明登录后的聊天接口一定可用。

两个实现仍有实质差异。消费者项目采用个人账号的令牌刷新流程与身份路由，连接参数固定为 `OfficeWebFreeConsumerCopilot` 和 `Free`。企业项目原有的登录方式不能因此直接照搬。开发方向可以收窄到消费者认证、场景参数和会话适配，再检查现有的消息解析是否适用。

付费订阅也需要单独核实。这个消费者项目固定使用 `Magic`，请求里的 `model` 只用于返回标签，没有传给后端的聊天方法。源码里未看到个人 Premium、Pro 等订阅权益的映射。用它得到一条标着某个模型名字的回答，仍不足以证明请求进入了那个模型，或使用了个人订阅的额外权益。[2]

这个区别在其他代理里同样存在。另一个项目 copilot-wraper 提供了 `/v1/messages`，还列出了一些客户端接入结果。继续看请求模型，会发现它明确把 `tools` 等扩展字段接受后忽略；非流式 Anthropic 响应只包含文本块。[3] 从结构看它实现了普通问答所需的接口，文件读取和编辑仍缺少工具调用所需的处理，本次没有实测它的聊天连通性。

m365-copilot-proxy 自己实现了代码块工具解析，走得更远一些。不过，它的一项工具测试也有容易被高估的地方。

离线复现保留了 `index.test.ts` 中的测试正文，仅把测试运行器和应用入口换成完全本地的替身。聊天替身始终返回一段普通文字，明确表示没有运行工具。它不连接网络，也不会执行模型命令。

结果如下。

| 检查项 | 离线结果 |
| --- | --- |
| 原测试文件通过数量 | 3 项 |
| 聊天请求数量 | 1 次 |
| 返回的工具调用 | 0 次 |
| 实际执行工具 | 0 次 |

原因可以直接在原测试里找到。只有回答包含 `tool_calls`，测试才进入执行与回传结果的分支。模型给出普通文本时，另一个分支只要求内容非空。健康检查和模型列表测试也会照常通过。[4]

这组实验限定的是测试能证明的范围。它没有测量真实 Copilot 的工具调用成功率，也不能据此评价整个项目的质量。它足以提醒我们，一份带有“工具调用”名称的测试通过以后，还要看断言是否真的要求工具运行。

随后又运行了项目里的模型路由函数和能力描述函数。它们给出了另外两项确定的结果。

| 输入或检查 | 原代码的离线输出 |
| --- | --- |
| 完全不存在的模型名 | 路由到 `magic` |
| 虚构的 `claude` 开头模型名 | 路由到 `Claude_Sonnet` |
| 为本地假模型构建能力描述 | 输入与输出上限均显示为 100 万 token |

原代码为未知名字提供了回退规则，响应中的 `model` 字段也沿用请求解析后的模型变量。它适合标识一次请求使用的代理配置，却不能独立充当上游模型身份的证据。[5]

100 万 token 同样来自代理自身的默认值。源码注释已经说明，这些数字用于避免客户端过早裁剪内容，属于对外提示，不是上游保证的窗口和输出能力。[6] 博客、配置页面和评测如果引用这个数字，应当保留这层说明。

最后一组实验直接运行原工具解析器。提供一个名为 `shell`、参数为 `command` 的工具后，模型样例中的 `bash` 代码块会被转成 `shell` 调用。纯文本的“已经修好了”则不会产生调用。带一句简短建议的 `bash` 代码块，也可以被识别为动作。[7]

这说明工具能力还有一项需要认真验证的语义问题。代理可以把代码块变成结构化调用，但最终是否需要执行、执行结果是否回传、模型是否根据真实报错继续修改，要由完整的 Agent 循环来证明。此次解析实验没有执行任何样例命令。

三个客户端的工作量也有差别。Hermes 支持自定义 Chat Completions，最接近现有项目的接口。Codex 当前的自定义提供方要求 Responses 协议。Claude Code 的自定义网关需要 Anthropic Messages，还要求完整的流式事件。[8][9][10] 同时接三者，会把消费者通道与客户端兼容问题混在一起，定位失败会更困难。

微软官方 Chat API 目前也不能替代这项消费者适配。它的权限表明确不支持个人微软账号，许可要求写的是 Microsoft 365 Copilot add-on。个人订阅中的网页使用权益，不能直接推导为该企业 API 的调用权限。[11]

经过这一轮研究，值得继续做的路线已经更具体了。先验证正常登录后的消费者聊天通道，再复用已有的 SignalR 解析与代码块工具转换，只给 Hermes 提供少量工具，完成一次真实的读取、修改与检查。登录能持续多久、付费权益怎样体现、模型能否根据工具结果连续行动，都留给这一轮实际调用记录回答。

当前成果是一份可复查的源码调查和离线实验。还不能把它写成个人 Copilot 已经稳定接入 Codex、Claude Code 或 Hermes 的成功教程。

## 来源与复现

目标项目固定提交为 `65905e881d6597040966aff9b087aa9a908b358a`。消费者参考实现固定提交为 `5b933d416e7e09095fc85ec9b895e28f8a2635de`。本次运行环境为 Node.js 24.18.0。

完整材料保存在 [GitHub 研究目录](https://github.com/shinchan-m/shinchan-m.github.io/tree/main/research/copilot-personal-agent)，包括复现脚本、原始结果和详细证据。脚本读取已有源码并在内存中执行相关函数，无需安装第三方依赖。运行方法和实验边界见该目录中的 README 与 evidence.md。

1. [消费者聊天协议源码](https://github.com/sums001/Windows-Copilot-API/blob/5b933d416e7e09095fc85ec9b895e28f8a2635de/copilot/protocol.py)
2. [消费者代理请求处理](https://github.com/sums001/Windows-Copilot-API/blob/5b933d416e7e09095fc85ec9b895e28f8a2635de/server/api.py)
3. [另一代理对工具字段的处理](https://github.com/zumanm1/copilot-wraper/blob/6d807c5939af2364a7224b4b785d581caf699cf4/models.py)与[文本响应实现](https://github.com/zumanm1/copilot-wraper/blob/6d807c5939af2364a7224b4b785d581caf699cf4/server.py)
4. [目标项目的原始集成测试](https://github.com/cramt/m365-copilot-proxy/blob/65905e881d6597040966aff9b087aa9a908b358a/packages/proxy-lib/src/index.test.ts)
5. [目标项目的模型路由](https://github.com/cramt/m365-copilot-proxy/blob/65905e881d6597040966aff9b087aa9a908b358a/packages/core/src/copilot.ts)
6. [目标项目的模型能力提示值](https://github.com/cramt/m365-copilot-proxy/blob/65905e881d6597040966aff9b087aa9a908b358a/packages/proxy-lib/src/index.ts)
7. [目标项目的工具解析实现](https://github.com/cramt/m365-copilot-proxy/blob/65905e881d6597040966aff9b087aa9a908b358a/packages/core/src/tools.ts)
8. [Hermes 自定义提供方文档](https://hermes-agent.nousresearch.com/docs/integrations/providers)
9. [Codex 官方配置参考](https://developers.openai.com/codex/config-reference/)
10. [Claude Code 网关协议](https://code.claude.com/docs/en/llm-gateway-protocol.md)
11. [微软 Chat API 权限表](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/api/ai-services/chat/copilotroot-post-conversations)与[许可要求](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/api/ai-services/chat/overview)
