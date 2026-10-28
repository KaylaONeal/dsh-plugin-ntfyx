# Ntfyx 手机回复

从 https://ntfyx.me/install/ 安装 Ntfyx CLI 0.6.0+，确保启动 DSH 的环境能在 PATH 中找到 `ntfyx`。受保护通知和问答需要先运行 `ntfyx connect`，用手机上的 Ntfyx 1.8.0+ 扫码授权。安装本插件后重启 DSH。

告诉 DSH：**“读取 ntfyx skill，用 Ntfyx 向我的手机提一个测试问题。需要我决策时使用 Ntfyx，并在本任务完成后发送通知。”** 日常解释仍在当前对话进行；尊重用户指定的沟通渠道。

工具名称以 `mcp__ntfyx__` 开头。通过 `mcp__ntfyx__ntfyx_ask` 提问，保留原请求标识，使用 `mcp__ntfyx__ntfyx_result` 等待。只有本地验签成功并一次领取的答案才允许继续对应动作；超时不等于同意。同一任务的通知和问答复用一个 Session。

本插件提供 MCP 工具和 Skill。完成通知由 Agent 调用工具发送；首版没有自动完成 Hook，也不拦截 DSH 原生提问或工具权限审批。DSH 自身的权限设置继续生效。

公开 Topic 收发无需配对；首次发送前必须取得用户对 https://ntfyx.me/terms/ 的明确同意。公开消息不加密，不能授权执行。受保护 Topic 使用端到端加密。

这是由 Ntfyx 维护的 DSH 社区插件，不是 DeepSeek 维护的 Official 内置插件。插件源码采用 MIT 许可；配套 CLI、App 和托管服务遵循各自条款。
