# Ntfyx 的 DeepSeek Harness 插件

[English](README.md) · [Ntfyx 官网](https://ntfyx.me/zh/) · [CLI 安装](https://ntfyx.me/zh/install/)

把 dsh 的任务通知和富消息报告发到手机。Agent 提问后，你可以在 iPhone、Android 或手机授权的 Web Inbox 中点击选项或输入文字；电脑上的 Ntfyx CLI 验证签名并一次领取答案，再继续对应任务。

**插件 0.1.0 · Ntfyx CLI 0.6.0+ · DSH 0.2.2-alpha.2 · Node.js 24.9+。** DSH 仍处于开发预览期，首版仅声明已核验版本。

## 安装

先安装签名 CLI，不传其他 Agent 的配置参数：

```sh
curl -fsSL https://ntfyx.me/install.sh | bash
export PATH="$HOME/.local/bin:$PATH"
ntfyx version --json
ntfyx connect
```

受保护通知和手机问答需要 `connect`：使用 Ntfyx 1.8.0+ 扫码授权并选择受保护 Topic。公开 Topic 收发无需配对。

安装到你实际使用的 DSH profile：

```sh
dsh plugin --profile web add dsh-plugin-ntfyx@0.1.0
dsh web
```

将 `web` 换成实际 profile 名称。通过 npx 启动时，将 `dsh` 换为 `npx @deepseek-ai/dsh@0.2.2-alpha.2`。插件安装命令还需要 PATH 中有 pnpm。已运行的 DSH 安装后要重启。

也可直接从 GitHub 安装，无需编译或安装脚本：

```sh
dsh plugin --profile web add github:KaylaONeal/dsh-plugin-ntfyx#v0.1.0
```

告诉 DSH：

> 读取 ntfyx skill，用 Ntfyx 向我的手机提一个测试问题。需要我决策时使用 Ntfyx，并在本任务完成后发送通知。

收到手机签名回复并返回原等待调用，才证明实际问答链路可用；安装成功本身不等于手机投递通过。

### 在 DSH 界面中发现

启用实验性 **Custom plugin indexes** 后，在 **Plugins → Discover → Add index source** 添加：

```text
https://raw.githubusercontent.com/KaylaONeal/dsh-plugin-ntfyx/main/plugins.json
```

这是 Ntfyx 自己维护的索引，使用 dsh 原生插件卡片、中英文详情和安装确认；不会因此成为 DeepSeek 维护的 Official 内置插件。

## 能力与边界

原生 `cordis.patch.yml` 通过 DSH 官方 MCP 客户端启动本机的 `ntfyx mcp`，并注册 `ntfyx` Skill。插件页包含中英文说明和图标。

支持受保护通知、Markdown/结构化报告、按钮/文字问答、结果领取与取消、公开 Topic 收发、本地消息校验及用量查询。工具名称以 `mcp__ntfyx__` 开头，例如 `mcp__ntfyx__ntfyx_ask`。

同一任务复用 `session_id`，等待时保留原 `request_id`。仅在 `status: "answered"` 且 `consumption.claim_acquired: true` 时继续；确认问题还须检查 `response.value: "allow"`。拒绝、超时、取消和验签失败都不是同意。用户已有授权和当前指定的沟通渠道继续有效。

完成通知由 Agent 调用工具发送。首版没有自动生命周期 Hook，也不拦截 dsh 原生提问或工具权限审批；DSH 自身权限策略保持生效。

## 更新、移除与排查

```sh
dsh plugin --profile web update --latest dsh-plugin-ntfyx
dsh plugin --profile web remove dsh-plugin-ntfyx
```

操作后重启 profile。移除插件不会删除 Ntfyx CLI 或配对凭据。

GitHub 安装固定了版本标签；升级时用 `add github:KaylaONeal/dsh-plugin-ntfyx#v新版本` 安装新标签，普通 update 不会切换标签。

运行 `ntfyx doctor` 和 `ntfyx version --json` 检查本机环境。GUI 启动的 DSH 也必须能从 PATH 找到 `ntfyx`。CLI 缺失时 DSH 记录 MCP 连接错误并继续启动；修正 PATH 后重启。同一作用域不要重复配置名为 `ntfyx` 的 MCP 客户端。

`dsh --profile web --dump-config` 仅查看配置组合，不验证 MCP 或手机投递。版本发布记录区分 Linux 运行验证、本地消息校验和真实手机验收。

在仓库目录中运行 `npm test -- --ntfyx /本机/ntfyx/绝对路径` 可复现隔离验证。测试下载少量官方 DSH 运行包，禁用安装脚本，打包安装本插件并启动真实配置，检查 MCP 工具发现、本地消息校验和 Skill 发现。它使用无配对的临时配置，不调用模型、不发送通知；证据保存于 `.local/dsh-plugin-test/`。需要 Node 24+ 和 npm。

## 发布与隐私

这是 Ntfyx 维护的 DSH 社区插件，不是 DeepSeek 维护的 Official 内置插件。上游当前不接受外部 PR，也没有默认第三方插件索引；[官方贡献指南](https://github.com/deepseek-ai/deepseek-harness/blob/master/CONTRIBUTING.md)建议发布 GitHub 仓库并添加 `dsh-plugin` topic。自建索引的格式见[官方说明](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/plugin-market.md)。

受保护消息与回复端到端加密。公开 Topic 对知道标识的人可见，不加密，也不能授权执行；首次公开发送前须取得用户对[服务条款](https://ntfyx.me/terms/)的明确同意。提供 Topic 链接不等于同意。

插件配置与 Skill 采用 MIT 许可。配套 CLI、App 和托管服务遵循独立许可与条款；本仓库不包含应用核心源码或自托管发行。[隐私政策](https://ntfyx.me/privacy/) · [支持](https://ntfyx.me/support/)。
