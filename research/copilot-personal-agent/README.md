# 个人 Copilot 与编程 Agent 研究

截至 2026 年 11 月 11 日的源码调查和离线复现，覆盖个人 Copilot 代理、模型路由与工具调用兼容性。

- [博客正文](https://shinchan-m.github.io/posts/copilot-personal-agent-research.html)
- [Markdown 原稿](../../guides/copilot-personal-agent-research.md)
- [证据与方法](evidence.md)
- [复现脚本](reproduce.mjs)
- [离线原始结果](offline-results.json)
- [公开网页观察记录](public-observation.json)

本研究没有登录个人账号或调用真实 Copilot 聊天。离线实验中，真实上游请求与模型工具执行均为零。原测试 3/3 通过，是保留原断言、替换应用入口的反例，不表示真实服务成功率。

## 复现

需要 Node.js 24 与 Git。将目标仓库放在你选择的位置并切换到固定提交。脚本会核验该提交后再执行。

```sh
git clone https://github.com/cramt/m365-copilot-proxy.git
git -C m365-copilot-proxy checkout 65905e881d6597040966aff9b087aa9a908b358a
node reproduce.mjs ./m365-copilot-proxy ./your-results.json
```

脚本无第三方依赖。它读取目标源码、在内存中转换运行，不导入原认证模块，不执行模型命令。其他工作目录请调整仓库路径。原源码 SHA-256 见离线结果。

四组检查分别针对原集成测试断言、模型名路由、能力提示值和代码块工具解析。完整边界见 evidence.md。Node.js 可能打印 stripTypeScriptTypes 的实验性功能提示。
