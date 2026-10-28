# Ntfyx for DeepSeek Harness

[中文](README.zh.md) · [Ntfyx](https://ntfyx.me/) · [Install the CLI](https://ntfyx.me/install/)

Send task notifications and rich reports from DeepSeek Harness (`dsh`) to your phone. Ask a question, answer with buttons or text on iPhone, Android or a phone-authorized Web Inbox, and let the local Ntfyx CLI verify and claim the reply before the agent continues.

**Plugin 0.1.0 · Ntfyx CLI 0.6.0+ · DSH 0.2.2-alpha.2 · Node.js 24.9+.** DSH is in developer preview; this initial release declares only the DSH version it was checked against.

## Install

Install the signed Ntfyx CLI without configuring another agent:

```sh
curl -fsSL https://ntfyx.me/install.sh | bash
export PATH="$HOME/.local/bin:$PATH"
ntfyx version --json
ntfyx connect
```

`connect` is needed for protected notifications and phone questions. Scan and authorize the connection from Ntfyx 1.8.0+ and select a protected Topic. Public Topic operations require no pairing.

Install the native bundle in the DSH profile you use:

```sh
dsh plugin --profile web add dsh-plugin-ntfyx@0.1.0
dsh web
```

Replace `web` with your profile name. If you launch DSH through npx, use `npx @deepseek-ai/dsh@0.2.2-alpha.2` in place of `dsh`. DSH's plugin command also requires pnpm on PATH. Restart an already running profile after installation.

GitHub is an alternative package source; the bundle ships ready to use and has no build or installation scripts:

```sh
dsh plugin --profile web add github:KaylaONeal/dsh-plugin-ntfyx#v0.1.0
```

Tell DSH:

> Read the ntfyx skill, then use Ntfyx to ask me a test question on my phone. Use Ntfyx for decisions and send a completion notification for this task.

An actual signed reply returning to the waiting agent verifies the phone workflow. A successful installation alone does not verify phone delivery.

### Discover in the DSH interface

If you enable DSH's experimental **Custom plugin indexes** bundle, open **Plugins → Discover → Add index source** and add:

```text
https://raw.githubusercontent.com/KaylaONeal/dsh-plugin-ntfyx/main/plugins.json
```

This is the Ntfyx-maintained index. It shows the native bundle with its icon, English/Chinese details and install confirmation; it does not make the plugin a DeepSeek-maintained Official bundle.

## What the bundle provides

The native `cordis.patch.yml` starts your installed `ntfyx mcp` through DSH's official MCP client and registers the bundled `ntfyx` skill. The package includes English and Chinese plugin details and an icon for DSH's Plugins page. It contains no credentials, transcript uploader, hosted MCP endpoint or replacement approval engine.

| Capability | DSH tool |
| --- | --- |
| Protected notifications and rich reports | `mcp__ntfyx__ntfyx_send` |
| Phone questions | `mcp__ntfyx__ntfyx_ask` |
| Wait for and claim a verified answer | `mcp__ntfyx__ntfyx_result` |
| Cancel a pending question | `mcp__ntfyx__ntfyx_cancel` |
| Local rich-message validation | `mcp__ntfyx__ntfyx_validate_message` |
| Public Topic notifications and reads | `mcp__ntfyx__ntfyx_public_send`, `mcp__ntfyx__ntfyx_public_read` |
| Paired Inbox usage | `mcp__ntfyx__ntfyx_usage` |

Use one `session_id` for the current task's updates and questions. Pending questions keep the same `request_id`; continue only after `status: "answered"` and `consumption.claim_acquired: true`. For a confirmation, only `response.value: "allow"` permits the described action. Denial, timeout, cancellation and failed verification never mean consent. Existing authorization and the user's channel choice remain in force.

Completion notifications are agent tool calls. This version has no automatic lifecycle hooks, does not intercept native DSH questions, and does not approve DSH tool-permission prompts. DSH's normal permission policy still controls tool execution.

## Update or remove

```sh
dsh plugin --profile web update --latest dsh-plugin-ntfyx
dsh plugin --profile web remove dsh-plugin-ntfyx
```

Restart the profile. Removing the bundle preserves your Ntfyx CLI and paired credentials.

For a GitHub installation, install the new release tag with `add github:KaylaONeal/dsh-plugin-ntfyx#vNEW_VERSION`; updating a pinned tag does not select a newer tag.

## Verify locally

From a checkout of this repository, with Node 24+ and npm installed:

```sh
npm test -- --ntfyx /absolute/path/to/ntfyx
```

The test installs a small set of official DSH runtime packages with install scripts disabled, packs this bundle, and boots its real patch in an isolated profile. It checks Ntfyx MCP discovery, local message validation and installed skill discovery. It uses an unpaired temporary identity store, calls no model, and sends no notification. Evidence is saved under `.local/dsh-plugin-test/`. Use `--runtime PATH` to reuse a runtime created by an earlier run.

## Troubleshooting

Run `ntfyx doctor` and `ntfyx version --json` in the environment that launches DSH. Desktop launchers must also have `ntfyx` on PATH. The bundle's MCP entry ID is `ntfyx-mcp`; its transport timeout allows a 45-second Ntfyx question/result wait. If the CLI is absent or cannot start, DSH logs an MCP connection error and continues; fix PATH and restart. Avoid adding a second MCP client named `ntfyx` in the same scope.

DSH's `--dump-config` can inspect composition without starting plugins:

```sh
dsh --profile web --dump-config
```

That command does not prove MCP connectivity or phone delivery. Linux runtime checks and local rich-message validation are recorded in the release notes. Other operating systems and real DSH-to-phone delivery require separate acceptance.

## Distribution and privacy

This is the Ntfyx-maintained community plugin for DSH. DeepSeek currently distributes its own Official bundles and ships no default third-party plugin index. The upstream contribution guide recommends publishing a GitHub repository with the `dsh-plugin` topic and currently does not accept external pull requests. See the [official contribution guide](https://github.com/deepseek-ai/deepseek-harness/blob/master/CONTRIBUTING.md) and [plugin-index guide](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/plugin-market.md).

Protected messages and answers are encrypted on devices; the service handles routing metadata and ciphertext. Public Topic messages are visible to the service and anyone who knows the Topic ID, are not end-to-end encrypted, and cannot authorize actions. The user must explicitly accept [the public-content terms](https://ntfyx.me/terms/) before the first public send; a Topic link is not consent.

The bundle configuration and skill are MIT licensed. The companion CLI, apps and hosted service follow their own license and [service terms](https://ntfyx.me/terms/). This repository does not contain Ntfyx's application core or a self-hosting distribution. [Privacy](https://ntfyx.me/privacy/) · [Support](https://ntfyx.me/support/).
